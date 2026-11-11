/**
 * sight-report-embed.js — Sight Report 嵌入 SDK（零依赖单文件，UMD）
 *
 * 把「签名 URL + iframe + postMessage 协议」封装成开发者友好的 API。
 * SDK 不做签名（appSecret 只能在第三方后端），只消费后端生成的 embedUrl；
 * 协议自足，不用 SDK 也能裸 postMessage 接入（见三方集成文档页示例）。
 *
 * 用法：
 *   const report = SightReportEmbed.mount('#box', {
 *     getEmbedUrl: () => fetch('/my-backend/embed-url').then(r => r.text()),
 *   })
 *   await report.ready()
 *   report.on('patient-selected', (e) => console.log(e.payload))
 *   await report.setParameters({ year: 2025 })
 *   const state = await report.getState()
 *   const file = await report.getExportFile('pdf')   // { blob, fileName, size }：发远程打印 / 归档
 */
;(function (global, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory()
  } else {
    global.SightReportEmbed = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  var PROTOCOL = 'sight-report'
  var DEFAULT_TIMEOUT = 30000
  /** getExportFile 默认超时：服务端同步生成大文件可能要几十秒，比普通 invoke 长得多 */
  var EXPORT_FILE_TIMEOUT = 120000
  /** 报表侧到点会回明确的 timeout: 错误；SDK 多等这么久好收到它，而不是自己先报个笼统的超时 */
  var EXPORT_FILE_TIMEOUT_GRACE = 5000
  /** 需订阅才推送的过程性事件（on 这些事件时 SDK 自动发 subscribe） */
  var SUBSCRIPTION_EVENTS = ['report:query', 'report:query-done', 'report:export', 'report:print', 'report:resize']

  var seq = 0
  function nextId() {
    seq += 1
    return 'sre_' + Date.now().toString(36) + '_' + seq
  }

  function SightReportInstance(iframe, options, ownsIframe) {
    var self = this
    this._iframe = iframe
    this._options = options || {}
    this._ownsIframe = !!ownsIframe
    this._origin = this._options.origin || null
    this._timeoutMs = this._options.timeoutMs || DEFAULT_TIMEOUT
    this._listeners = {} // name -> [handler]
    this._anyListeners = []
    this._pending = {} // id -> { resolve, reject, timer }
    this._subscribed = {} // 已发送订阅的事件名
    this._loaded = false
    this._loadedEnvelope = null
    this._destroyed = false

    this._onMessage = function (event) {
      if (self._destroyed) return
      var data = event.data
      if (!data || data.protocol !== PROTOCOL) return
      // 只认本实例 iframe 发来的消息（同页多实例隔离）
      if (self._iframe.contentWindow && event.source !== self._iframe.contentWindow) return
      if (self._origin && event.origin !== self._origin) return

      if (data.type === 'invoke-result') {
        var pending = self._pending[data.id]
        if (pending) {
          delete self._pending[data.id]
          clearTimeout(pending.timer)
          if (data.ok) pending.resolve(data.data)
          else pending.reject(new Error(data.error || 'invoke failed'))
        }
        return
      }
      if (data.type === 'subscribe' || data.type === 'invoke') return // 宿主自己发的入站消息

      // 事件
      if (data.name === 'report:loaded') {
        self._loaded = true
        self._loadedEnvelope = data
        // 时序补救：iframe 的 load 事件可能早于报表内 SPA 挂上 message 监听，
        // 那时补发的订阅会丢失；loaded 事件保证报表侧监听已就绪，此处再补发一次（幂等）
        self._flushSubscriptions()
      }
      var handlers = (self._listeners[data.name] || []).slice()
      for (var i = 0; i < handlers.length; i++) {
        try {
          handlers[i](data)
        } catch (err) {
          console.error('[sight-report-embed] 事件处理器异常:', err)
        }
      }
      for (var j = 0; j < self._anyListeners.length; j++) {
        try {
          self._anyListeners[j](data)
        } catch (err2) {
          console.error('[sight-report-embed] 事件处理器异常:', err2)
        }
      }
    }
    window.addEventListener('message', this._onMessage)
  }

  SightReportInstance.prototype._post = function (message) {
    if (!this._iframe.contentWindow) throw new Error('iframe 尚未就绪')
    this._iframe.contentWindow.postMessage(message, this._origin || '*')
  }

  /** 订阅过程性事件（幂等；iframe 未就绪时静默失败，由 _flushSubscriptions 补发） */
  SightReportInstance.prototype._subscribe = function (events) {
    var toSend = []
    for (var i = 0; i < events.length; i++) {
      if (!this._subscribed[events[i]]) {
        this._subscribed[events[i]] = true
        toSend.push(events[i])
      }
    }
    if (toSend.length === 0) return
    try {
      this._post({ protocol: PROTOCOL, type: 'subscribe', events: toSend })
    } catch (err) {
      /* iframe 未就绪，ready 后补发 */
    }
  }

  SightReportInstance.prototype._flushSubscriptions = function () {
    var events = Object.keys(this._subscribed)
    if (events.length > 0) {
      try {
        this._post({ protocol: PROTOCOL, type: 'subscribe', events: events })
      } catch (err) {
        /* ignore */
      }
    }
  }

  /**
   * 等待报表首次加载完成。
   * 竞态兜底：loaded 事件可能在监听挂上前已发出（connect 模式），
   * 故同时轮询 getState 探测 loading:false，两者取先到。
   */
  SightReportInstance.prototype.ready = function () {
    var self = this
    if (this._loaded) return Promise.resolve(this._loadedEnvelope)
    return new Promise(function (resolve, reject) {
      var settled = false
      var pollTimer = null
      var timeoutTimer = setTimeout(function () {
        finish(new Error('等待报表加载超时'))
      }, self._timeoutMs)

      function finish(error, value) {
        if (settled) return
        settled = true
        clearTimeout(timeoutTimer)
        if (pollTimer) clearInterval(pollTimer)
        self.off('report:loaded', onLoaded)
        self.off('report:error', onError)
        if (error) reject(error)
        else resolve(value)
      }
      function onLoaded(envelope) {
        finish(null, envelope)
      }
      function onError(envelope) {
        if (envelope.payload && envelope.payload.phase === 'load') {
          finish(new Error(envelope.payload.message || '报表加载失败'))
        }
      }
      self.on('report:loaded', onLoaded)
      self.on('report:error', onError)

      // getState 轮询兜底（事件不缓冲不补发）
      pollTimer = setInterval(function () {
        self.invoke('getState').then(
          function (state) {
            if (state && state.loading === false) {
              self._loaded = true
              finish(null, { name: 'report:loaded', payload: {}, source: { reportId: state.reportId } })
            }
          },
          function () {
            /* 未就绪，继续等 */
          }
        )
      }, 800)
    })
  }

  SightReportInstance.prototype.on = function (name, handler) {
    if (!this._listeners[name]) this._listeners[name] = []
    this._listeners[name].push(handler)
    if (SUBSCRIPTION_EVENTS.indexOf(name) >= 0) this._subscribe([name])
    return this
  }

  SightReportInstance.prototype.once = function (name, handler) {
    var self = this
    var wrapped = function (envelope) {
      self.off(name, wrapped)
      handler(envelope)
    }
    return this.on(name, wrapped)
  }

  SightReportInstance.prototype.off = function (name, handler) {
    var list = this._listeners[name]
    if (list) {
      var index = list.indexOf(handler)
      if (index >= 0) list.splice(index, 1)
    }
    return this
  }

  SightReportInstance.prototype.onAny = function (handler) {
    this._anyListeners.push(handler)
    return this
  }

  /** 泛化方法调用：协议新增方法时旧 SDK 无需升级 */
  SightReportInstance.prototype.invoke = function (method) {
    return this._invoke(method, Array.prototype.slice.call(arguments, 1), this._timeoutMs)
  }

  SightReportInstance.prototype._invoke = function (method, args, timeoutMs) {
    var self = this
    return new Promise(function (resolve, reject) {
      var id = nextId()
      var timer = setTimeout(function () {
        delete self._pending[id]
        reject(new Error('invoke 超时: ' + method))
      }, timeoutMs)
      self._pending[id] = { resolve: resolve, reject: reject, timer: timer }
      try {
        self._post({ protocol: PROTOCOL, type: 'invoke', id: id, method: method, args: args })
      } catch (err) {
        delete self._pending[id]
        clearTimeout(timer)
        reject(err)
      }
    })
  }

  // invoke 白名单语法糖
  // 并非每种报表都支持全部方法：不支持的会明确回 ok:false / error 以 'unsupported:' 开头，
  // 不会静默成功。用 getState().fileType 判断当前是 grid / document / dashboard。
  var METHODS = [
    'setParameters',
    'getParameters',
    'query',
    'reset',
    'export',
    'print',
    'getState',
    'setSheet',
    'getCellValue',
    'getCellValues',
    'setTab',
    'getTabs',
  ]
  METHODS.forEach(function (method) {
    SightReportInstance.prototype[method] = function () {
      var args = Array.prototype.slice.call(arguments)
      return this.invoke.apply(this, [method].concat(args))
    }
  })

  /**
   * 取导出文件内容（不下载），拿去发远程打印、归档、上传。
   * 与报表工具栏导出是同一份文件：同一套命令名（pdf / pdfCurrent / pdfCurrentSheet / word / excel …）、
   * 同一份已提交的查询参数与 sheet 范围。
   *
   * resolve 为 { blob, fileName, contentType, size, format }。Blob 经 postMessage 传过来只传引用、不复制字节。
   *
   * options.maxBytes  上限字节数，默认 100 MB，0 不限；超了 reject 'too-large: ...'，报表侧不会把整份读进内存
   * options.timeoutMs 默认 120000；到点报表侧中断请求并 reject 'timeout: ...'
   *
   * 其他失败前缀：busy:（同一时刻只允许一个）/ unsupported: / session-expired: / export-failed: / not-ready
   */
  SightReportInstance.prototype.getExportFile = function (format, options) {
    options = options || {}
    var timeoutMs = options.timeoutMs > 0 ? options.timeoutMs : EXPORT_FILE_TIMEOUT
    var args = [format || 'pdf', { maxBytes: options.maxBytes, timeoutMs: timeoutMs }]
    return this._invoke('getExportFile', args, timeoutMs + EXPORT_FILE_TIMEOUT_GRACE)
  }

  /** 重新获取签名 URL 并重载（解决签名过期）；需 mount/connect 时提供 getEmbedUrl */
  SightReportInstance.prototype.reload = function () {
    var self = this
    if (!this._options.getEmbedUrl) {
      this._iframe.contentWindow && this._iframe.contentWindow.location.reload()
      return Promise.resolve()
    }
    this._loaded = false
    return Promise.resolve(this._options.getEmbedUrl()).then(function (url) {
      if (!self._origin) self._origin = new URL(url, window.location.href).origin
      self._iframe.src = url
      self._iframe.addEventListener(
        'load',
        function () {
          self._flushSubscriptions()
        },
        { once: true }
      )
    })
  }

  SightReportInstance.prototype.destroy = function () {
    this._destroyed = true
    window.removeEventListener('message', this._onMessage)
    var ids = Object.keys(this._pending)
    for (var i = 0; i < ids.length; i++) {
      clearTimeout(this._pending[ids[i]].timer)
      this._pending[ids[i]].reject(new Error('destroyed'))
    }
    this._pending = {}
    this._listeners = {}
    this._anyListeners = []
    if (this._ownsIframe && this._iframe.parentNode) {
      this._iframe.parentNode.removeChild(this._iframe)
    }
  }

  /** 创建 iframe 并挂载到容器 */
  function mount(container, options) {
    options = options || {}
    var el = typeof container === 'string' ? document.querySelector(container) : container
    if (!el) throw new Error('容器不存在: ' + container)
    var iframe = document.createElement('iframe')
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = 'none'
    iframe.setAttribute('title', 'Sight Report')
    el.appendChild(iframe)

    var instance = new SightReportInstance(iframe, options, true)
    var urlPromise = options.embedUrl
      ? Promise.resolve(options.embedUrl)
      : options.getEmbedUrl
        ? Promise.resolve(options.getEmbedUrl())
        : Promise.reject(new Error('必须提供 embedUrl 或 getEmbedUrl'))
    urlPromise.then(
      function (url) {
        if (!instance._origin) instance._origin = new URL(url, window.location.href).origin
        iframe.src = url
        iframe.addEventListener(
          'load',
          function () {
            instance._flushSubscriptions()
          },
          { once: true }
        )
      },
      function (err) {
        console.error('[sight-report-embed] 获取 embedUrl 失败:', err)
      }
    )
    return instance
  }

  /** 接管宿主已有的 iframe（只管协议，不管 DOM） */
  function connect(iframeEl, options) {
    options = options || {}
    if (!options.origin && iframeEl.src) {
      try {
        options.origin = new URL(iframeEl.src, window.location.href).origin
      } catch (err) {
        /* ignore */
      }
    }
    var instance = new SightReportInstance(iframeEl, options, false)
    // 已就绪的 iframe 直接补发订阅；未就绪等 load
    if (iframeEl.contentWindow) instance._flushSubscriptions()
    iframeEl.addEventListener('load', function () {
      instance._flushSubscriptions()
    })
    return instance
  }

  return { mount: mount, connect: connect, PROTOCOL: PROTOCOL }
})
