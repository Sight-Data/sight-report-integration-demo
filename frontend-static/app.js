/*
 * Sight Report 集成控制台 — 零依赖前端
 *
 * 这个文件只演示「第三方宿主页面」该怎么做：
 *   1. 向自己的后端要签名后的 embed URL（appSecret 永远不出现在这里）
 *   2. 用 iframe 打开报表，并监听 / 订阅报表事件
 *   3. 用 sight-report-embed.js 反向调用报表方法
 * 真实业务里把这些片段搬进你自己的页面即可。
 */
;(function () {
  'use strict'

  const PROTOCOL = 'sight-report'
  const STORE_KEY = 'sight-report-integration-demo:v2'

  const $ = (id) => document.getElementById(id)

  const el = {
    backendBaseUrl: $('backendBaseUrl'),
    loadConfigBtn: $('loadConfigBtn'),
    resetStateBtn: $('resetStateBtn'),
    backendInfo: $('backendInfo'),
    pillConnection: $('pillConnection'),
    connectionText: $('connectionText'),
    reportBaseText: $('reportBaseText'),
    appIdText: $('appIdText'),
    reportIdText: $('reportIdText'),

    account: $('account'),
    userName: $('userName'),
    reportId: $('reportId'),
    expireMinutes: $('expireMinutes'),

    discoverBtn: $('discoverBtn'),
    fileType: $('fileType'),
    fileTypeField: $('fileTypeField'),
    tag: $('tag'),
    tagField: $('tagField'),
    pickerFilter: $('pickerFilter'),
    reportList: $('reportList'),

    paramRows: $('paramRows'),
    paramJson: $('paramJson'),
    paramError: $('paramError'),
    paramAddBtn: $('paramAddBtn'),
    paramJsonBtn: $('paramJsonBtn'),

    viewMode: $('viewMode'),
    exportFileName: $('exportFileName'),
    hideToolbar: $('hideToolbar'),
    showQueryForm: $('showQueryForm'),
    autoSubscribe: $('autoSubscribe'),
    openEmbedBtn: $('openEmbedBtn'),

    subQuery: $('subQuery'),
    subQueryDone: $('subQueryDone'),
    subExport: $('subExport'),
    subPrint: $('subPrint'),
    subscribeBtn: $('subscribeBtn'),
    subscribeAllBtn: $('subscribeAllBtn'),

    invokeParams: $('invokeParams'),
    invokeCellName: $('invokeCellName'),

    stagedDatasets: $('stagedDatasets'),
    stagedStatus: $('stagedStatus'),
    stagedSetBtn: $('stagedSetBtn'),
    stagedEmbedBtn: $('stagedEmbedBtn'),
    stagedClearBtn: $('stagedClearBtn'),

    reportFrame: $('reportFrame'),
    viewerEmpty: $('viewerEmpty'),
    viewerStatus: $('viewerStatus'),
    reloadEmbedBtn: $('reloadEmbedBtn'),
    openNewWindowLink: $('openNewWindowLink'),

    paneEvents: $('paneEvents'),
    paneInvoke: $('paneInvoke'),
    paneUrl: $('paneUrl'),
    paneDiscovery: $('paneDiscovery'),
    paneRequests: $('paneRequests'),
    inspCopyBtn: $('inspCopyBtn'),
    inspClearBtn: $('inspClearBtn'),
    inspExpandBtn: $('inspExpandBtn'),

    expandModal: $('expandModal'),
    expandTitle: $('expandTitle'),
    expandContent: $('expandContent'),
    expandCopyBtn: $('expandCopyBtn'),
    toastHost: $('toastHost')
  }

  const state = {
    params: [
      { key: 'year', value: '2024' },
      { key: 'month', value: '1' }
    ],
    paramsAsJson: false,
    discoverMode: 'type-tree',
    reports: [],
    stagedToken: null,
    embedUrl: '',
    reportOrigin: '',
    sdk: null,
    activeInspector: 'events'
  }

  const TEXT_FIELDS = [
    'backendBaseUrl',
    'account',
    'userName',
    'reportId',
    'expireMinutes',
    'viewMode',
    'exportFileName',
    'tag',
    'fileType',
    'invokeParams',
    'invokeCellName',
    'stagedDatasets'
  ]
  const FLAG_FIELDS = [
    'hideToolbar',
    'showQueryForm',
    'autoSubscribe',
    'subQuery',
    'subQueryDone',
    'subExport',
    'subPrint'
  ]

  // ── 本地记忆：刷新页面不用重填 ─────────────────────────────
  function saveState() {
    const snapshot = { params: state.params, discoverMode: state.discoverMode }
    TEXT_FIELDS.forEach((key) => {
      snapshot[key] = el[key].value
    })
    FLAG_FIELDS.forEach((key) => {
      snapshot[key] = el[key].checked
    })
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(snapshot))
    } catch {
      /* 隐私模式下忽略 */
    }
  }

  function restoreState() {
    let snapshot = null
    try {
      snapshot = JSON.parse(localStorage.getItem(STORE_KEY) || 'null')
    } catch {
      snapshot = null
    }
    if (!snapshot) return
    TEXT_FIELDS.forEach((key) => {
      if (typeof snapshot[key] === 'string' && snapshot[key] !== '') el[key].value = snapshot[key]
    })
    FLAG_FIELDS.forEach((key) => {
      if (typeof snapshot[key] === 'boolean') el[key].checked = snapshot[key]
    })
    if (Array.isArray(snapshot.params) && snapshot.params.length) state.params = snapshot.params
    if (snapshot.discoverMode) state.discoverMode = snapshot.discoverMode
  }

  // ── 输出：右侧观察窗 + toast ──────────────────────────────
  function now() {
    return new Date().toLocaleTimeString('zh-CN', { hour12: false })
  }

  function prepend(pane, text) {
    pane.textContent = `${text}\n\n${pane.textContent}`.trimEnd()
  }

  function logRequest(title, body) {
    prepend(el.paneRequests, `[${now()}] ${title}\n${body}`)
  }

  function logInvoke(title, body) {
    prepend(el.paneInvoke, `[${now()}] ${title}\n${body}`)
    switchInspector('invoke')
  }

  function toast(message, kind) {
    const node = document.createElement('div')
    node.className = `toast${kind ? ` ${kind}` : ''}`
    node.textContent = message
    el.toastHost.appendChild(node)
    setTimeout(() => node.remove(), kind === 'danger' ? 6000 : 3200)
  }

  function fail(message) {
    toast(message, 'danger')
    logRequest('错误', message)
  }

  // ── 请求：统一错误可读化 ──────────────────────────────────
  function backendBase() {
    return el.backendBaseUrl.value.trim().replace(/\/+$/, '')
  }

  function describeHttpError(status, text) {
    let detail = text
    try {
      const parsed = JSON.parse(text)
      detail = parsed.message || parsed.msg || text
    } catch {
      /* 原样保留 */
    }
    if (status === 0) return '请求发不出去：确认 demo 后端已启动，且地址填写正确'
    if (status === 400) return `参数不合法：${detail}`
    if (status === 401 || status === 403) {
      return `签名被拒（${status}）：检查 appId / appSecret、签名有效期，以及 reportId 是否在应用白名单内。${detail}`
    }
    if (status === 404) return `接口不存在（404）：确认报表系统地址与版本。${detail}`
    if (status >= 500) return `报表系统或 demo 后端出错（${status}）：${detail}`
    return `请求失败（${status}）：${detail}`
  }

  async function requestJson(path, options = {}) {
    const url = `${backendBase()}${path}`
    logRequest('Request', `${options.method || 'GET'} ${url}`)

    let response
    try {
      response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options
      })
    } catch (error) {
      throw new Error(describeHttpError(0, error.message))
    }

    const text = await response.text()
    logRequest('Response', `${response.status}\n${text}`)
    if (!response.ok) throw new Error(describeHttpError(response.status, text))

    const data = text ? JSON.parse(text) : null
    // 代理类接口会把报表系统的信封原样透传：HTTP 200 里仍可能是业务错误（code !== 0）
    if (data && typeof data === 'object' && 'code' in data && data.code !== 0 && data.success !== true) {
      throw new Error(
        `报表系统拒绝了请求（code ${data.code}）：${data.message || data.msg || '无错误描述'}`
      )
    }
    return data
  }

  // ── 顶栏状态 ──────────────────────────────────────────────
  function setConnection(stateName, text) {
    el.pillConnection.dataset.state = stateName
    el.connectionText.textContent = text
  }

  function updateHeader() {
    el.reportIdText.textContent = el.reportId.value.trim() || '-'
  }

  function setViewerState(stateName, text) {
    el.viewerStatus.dataset.state = stateName
    el.viewerStatus.textContent = text
  }

  // ── 第 1 步：读取后端配置并检测连通性 ─────────────────────
  async function loadBackendConfig() {
    setConnection('unknown', '检测中…')
    try {
      const data = await requestJson('/api/demo/config')
      el.reportBaseText.textContent = data.baseUrl || '-'
      el.appIdText.textContent = data.appId || '-'
      const reach = data.upstream || {}
      if (reach.reachable === false) {
        setConnection('partial', '后端在，报表系统不通')
        el.backendInfo.className = 'banner warn'
        el.backendInfo.textContent =
          `demo 后端正常，但访问不到报表系统 ${data.baseUrl}：${reach.message || '无响应'}。` +
          '请检查地址、端口与网络。'
      } else {
        setConnection('ok', '正常')
        el.backendInfo.className = 'banner ok'
        el.backendInfo.textContent =
          `appId ${data.appId} · 报表系统 ${data.baseUrl} · 签名有效期 ` +
          `${data.defaultExpireMinutes}~${data.maxExpireMinutes} 分钟`
      }
    } catch (error) {
      setConnection('fail', '连不上')
      el.backendInfo.className = 'banner danger'
      el.backendInfo.textContent = error.message
      throw error
    }
  }

  // ── 第 2 步：报表发现（目录树 / 标签） ────────────────────
  function looksLikeReport(node) {
    const hasId = node.id != null || node.fileId != null
    const hasName = node.name || node.title || node.fileName || node.label
    const children = node.children || node.childList || node.nodes
    return hasId && hasName && !(Array.isArray(children) && children.length)
  }

  /** 目录树结构随版本可能变化，这里做防御式遍历，同时把原始 JSON 落到「发现结果」 */
  function flattenReports(payload) {
    const found = []
    const seen = new Set()

    function walk(node, trail) {
      if (Array.isArray(node)) {
        node.forEach((item) => walk(item, trail))
        return
      }
      if (!node || typeof node !== 'object') return

      const label = node.name || node.title || node.fileName || node.label || ''
      if (looksLikeReport(node)) {
        const id = String(node.fileId != null ? node.fileId : node.id)
        if (!seen.has(id)) {
          seen.add(id)
          found.push({
            id,
            name: label || id,
            group: trail.join(' / '),
            fileType: node.fileType || node.type || ''
          })
        }
      }

      const nextTrail = label && !looksLikeReport(node) ? trail.concat(label) : trail
      Object.keys(node).forEach((key) => {
        const value = node[key]
        if (value && typeof value === 'object') walk(value, nextTrail)
      })
    }

    walk(payload && payload.data !== undefined ? payload.data : payload, [])
    return found
  }

  function renderReportList() {
    const keyword = el.pickerFilter.value.trim().toLowerCase()
    const current = el.reportId.value.trim()
    const items = keyword
      ? state.reports.filter(
          (item) =>
            item.name.toLowerCase().includes(keyword) || item.id.toLowerCase().includes(keyword)
        )
      : state.reports

    if (!state.reports.length) {
      el.reportList.innerHTML =
        '<div class="empty-hint">尚未加载。列表来自 <code>/api/embed/report/type-tree</code>' +
        ' 或 <code>tag-list</code>，受应用白名单限制。</div>'
      return
    }
    if (!items.length) {
      el.reportList.innerHTML = '<div class="empty-hint">没有匹配的报表。</div>'
      return
    }

    el.reportList.innerHTML = ''
    let lastGroup = null
    items.forEach((item) => {
      if (item.group && item.group !== lastGroup) {
        lastGroup = item.group
        const groupNode = document.createElement('div')
        groupNode.className = 'report-group'
        groupNode.textContent = item.group
        el.reportList.appendChild(groupNode)
      }
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `report-item${item.id === current ? ' selected' : ''}`
      const name = document.createElement('span')
      name.className = 'name'
      name.textContent = item.name
      const meta = document.createElement('span')
      meta.className = 'meta'
      meta.textContent = item.fileType ? `${item.id} · ${item.fileType}` : item.id
      button.append(name, meta)
      button.addEventListener('click', () => {
        el.reportId.value = item.id
        updateHeader()
        saveState()
        renderReportList()
        toast(`已选择报表：${item.name}`)
      })
      el.reportList.appendChild(button)
    })
  }

  async function discoverReports() {
    const context = readContext()
    if (!context) return

    const search = new URLSearchParams({
      account: context.account,
      userName: context.userName,
      expireMinutes: String(context.expireMinutes)
    })

    let path
    if (state.discoverMode === 'tag-list') {
      const tag = el.tag.value.trim()
      if (!tag) {
        fail('请填写 tag')
        return
      }
      search.set('tag', tag)
      path = `/api/demo/report/tag-list?${search.toString()}`
    } else {
      search.set('fileType', el.fileType.value)
      path = `/api/demo/report/type-tree?${search.toString()}`
    }

    const data = await requestJson(path)
    el.paneDiscovery.textContent = JSON.stringify(data, null, 2)
    switchInspector('discovery')

    state.reports = flattenReports(data)
    renderReportList()
    if (!state.reports.length) {
      toast('接口返回了数据，但没识别出报表条目，请看「发现结果」原始 JSON', 'danger')
    } else {
      toast(`发现 ${state.reports.length} 个报表`, 'ok')
    }
  }

  // ── 第 3 步：参数编辑器 ───────────────────────────────────
  function renderParamRows() {
    el.paramRows.innerHTML = ''
    state.params.forEach((param, index) => {
      const row = document.createElement('div')
      row.className = 'param-row'

      const keyInput = document.createElement('input')
      keyInput.type = 'text'
      keyInput.placeholder = '参数名'
      keyInput.value = param.key
      keyInput.addEventListener('input', () => {
        state.params[index].key = keyInput.value
        saveState()
      })

      const valueInput = document.createElement('input')
      valueInput.type = 'text'
      valueInput.placeholder = '值（数字/布尔/JSON 自动识别）'
      valueInput.value = param.value
      valueInput.addEventListener('input', () => {
        state.params[index].value = valueInput.value
        saveState()
      })

      const removeBtn = document.createElement('button')
      removeBtn.type = 'button'
      removeBtn.className = 'icon-btn'
      removeBtn.title = '删除'
      removeBtn.textContent = '×'
      removeBtn.addEventListener('click', () => {
        state.params.splice(index, 1)
        renderParamRows()
        saveState()
      })

      row.append(keyInput, valueInput, removeBtn)
      el.paramRows.appendChild(row)
    })
  }

  /** 表单里一律是字符串，这里还原成报表期望的类型 */
  function coerce(raw) {
    const text = String(raw).trim()
    if (text === '') return ''
    if (text === 'true') return true
    if (text === 'false') return false
    if (text === 'null') return null
    if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text)
    if (/^[[{]/.test(text)) {
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    }
    return text
  }

  function collectParameters() {
    el.paramError.classList.add('hidden')
    if (state.paramsAsJson) {
      const text = el.paramJson.value.trim()
      if (!text) return {}
      try {
        const parsed = JSON.parse(text)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('顶层必须是对象')
        }
        return parsed
      } catch (error) {
        el.paramError.textContent = `参数 JSON 无效：${error.message}`
        el.paramError.classList.remove('hidden')
        return null
      }
    }
    const result = {}
    state.params.forEach((param) => {
      const key = param.key.trim()
      if (key) result[key] = coerce(param.value)
    })
    return result
  }

  function toggleParamJson() {
    state.paramsAsJson = !state.paramsAsJson
    if (state.paramsAsJson) {
      const collected = {}
      state.params.forEach((param) => {
        const key = param.key.trim()
        if (key) collected[key] = coerce(param.value)
      })
      el.paramJson.value = JSON.stringify(collected, null, 2)
      el.paramJson.classList.remove('hidden')
      el.paramRows.classList.add('hidden')
      el.paramAddBtn.classList.add('hidden')
      el.paramJsonBtn.textContent = '表格视图'
    } else {
      try {
        const parsed = JSON.parse(el.paramJson.value || '{}')
        state.params = Object.keys(parsed).map((key) => ({
          key,
          value: typeof parsed[key] === 'object' ? JSON.stringify(parsed[key]) : String(parsed[key])
        }))
        renderParamRows()
        saveState()
      } catch {
        toast('JSON 无效，未同步回表格', 'danger')
      }
      el.paramJson.classList.add('hidden')
      el.paramRows.classList.remove('hidden')
      el.paramAddBtn.classList.remove('hidden')
      el.paramJsonBtn.textContent = 'JSON 视图'
    }
  }

  // ── 打开报表 ──────────────────────────────────────────────
  function readContext(options = {}) {
    const account = el.account.value.trim()
    const userName = el.userName.value.trim()
    const reportId = el.reportId.value.trim()
    const expireMinutes = Number.parseInt(el.expireMinutes.value, 10)

    if (!account || !userName) {
      fail('account 与 userName 必填：它们是签名的一部分')
      return null
    }
    if (!Number.isFinite(expireMinutes) || expireMinutes <= 0) {
      fail('签名有效期必须是正整数分钟')
      return null
    }
    if (options.requireReportId && !reportId) {
      fail('请先选择或填写 reportId')
      return null
    }
    return { account, userName, reportId, expireMinutes }
  }

  function applyEmbedUrl(embedUrl) {
    state.embedUrl = embedUrl
    try {
      state.reportOrigin = new URL(embedUrl).origin
    } catch {
      state.reportOrigin = ''
    }

    el.paneUrl.textContent = embedUrl
    el.viewerEmpty.classList.add('hidden')
    el.reportFrame.src = embedUrl
    el.openNewWindowLink.href = embedUrl
    el.openNewWindowLink.classList.remove('disabled')
    el.reloadEmbedBtn.disabled = false
    setViewerState('loading', '加载中…')

    if (state.sdk) {
      try {
        state.sdk.destroy()
      } catch {
        /* 忽略 */
      }
      state.sdk = null
    }
  }

  async function openEmbed() {
    const context = readContext({ requireReportId: true })
    if (!context) return
    const parameters = collectParameters()
    if (parameters === null) return

    const data = await requestJson('/api/demo/embed-url', {
      method: 'POST',
      body: JSON.stringify({
        ...context,
        parameters,
        hideToolbar: el.hideToolbar.checked,
        showQueryForm: el.showQueryForm.checked,
        viewMode: el.viewMode.value
      })
    })

    applyEmbedUrl(data.embedUrl)
    updateHeader()
    saveState()
    switchInspector('events')

    if (el.autoSubscribe.checked) {
      // iframe 加载完成后再订阅，否则报表侧还没挂上监听
      el.reportFrame.addEventListener('load', subscribeSelectedOnce, { once: true })
    }
  }

  function subscribeSelectedOnce() {
    const events = selectedEvents()
    if (events.length) subscribe(events, { silent: true })
  }

  // ── 事件：零配置接收 + 订阅过程性事件 ─────────────────────
  window.addEventListener('message', (event) => {
    const data = event.data
    if (!data || data.protocol !== PROTOCOL) return
    if (data.type === 'subscribe' || data.type === 'invoke') return
    if (state.reportOrigin && event.origin !== state.reportOrigin) return

    if (data.type === 'invoke-result') return // SDK 自己处理

    const source = data.source || {}
    const trail = [source.reportId, source.cellName, source.cid].filter(Boolean).join(' / ')
    prepend(
      el.paneEvents,
      `[${now()}] ${data.name}${trail ? `  (${trail})` : ''}\n` +
        JSON.stringify(data.payload ?? {}, null, 2)
    )

    if (data.name === 'report:loaded') {
      const elapsed = data.payload && data.payload.elapsedMs
      setViewerState('ready', elapsed ? `已就绪 · ${elapsed}ms` : '已就绪')
    }
    if (data.name === 'report:error') {
      setViewerState('error', '出错')
      const payload = data.payload || {}
      fail(`报表事件 report:error（${payload.phase || '未知阶段'}）：${payload.message || ''}`)
    }
  })

  function selectedEvents() {
    const events = []
    if (el.subQuery.checked) events.push('report:query')
    if (el.subQueryDone.checked) events.push('report:query-done')
    if (el.subExport.checked) events.push('report:export')
    if (el.subPrint.checked) events.push('report:print')
    return events
  }

  function subscribe(events, options = {}) {
    const frameWindow = el.reportFrame.contentWindow
    if (!state.embedUrl || !frameWindow) {
      fail('请先打开报表，再订阅事件')
      return
    }
    const targetOrigin = state.reportOrigin || '*'
    frameWindow.postMessage({ protocol: PROTOCOL, type: 'subscribe', events }, targetOrigin)
    logRequest('Subscribe', `events: ${JSON.stringify(events)}\ntargetOrigin: ${targetOrigin}`)
    if (!options.silent) toast(`已订阅：${events.join(', ')}`, 'ok')
  }

  // ── 宿主调用：sight-report-embed.js ───────────────────────
  function sdk() {
    if (!state.embedUrl) {
      fail('请先打开报表')
      return null
    }
    if (!state.sdk) {
      state.sdk = window.SightReportEmbed.connect(el.reportFrame, {
        origin: state.reportOrigin || undefined
      })
    }
    return state.sdk
  }

  function runInvoke(label, factory) {
    const instance = sdk()
    if (!instance) return
    let promise
    try {
      promise = factory(instance)
    } catch (error) {
      logInvoke(`${label} 参数错误`, error.message)
      return
    }
    if (!promise || typeof promise.then !== 'function') return
    promise
      .then((data) => logInvoke(`${label} OK`, JSON.stringify(data, null, 2)))
      .catch((error) => {
        logInvoke(`${label} FAIL`, error.message)
        toast(`${label} 失败：${error.message}`, 'danger')
      })
  }

  // ── 外部数据集 ────────────────────────────────────────────
  function setStagedToken(token) {
    state.stagedToken = token
    const has = Boolean(token)
    el.stagedEmbedBtn.disabled = !has
    el.stagedClearBtn.disabled = !has
    el.stagedStatus.className = has ? 'banner ok' : 'banner neutral'
    el.stagedStatus.textContent = has ? `token: ${token}` : '未上传'
  }

  async function stagedSet() {
    const context = readContext()
    if (!context) return
    let datasets
    try {
      datasets = JSON.parse(el.stagedDatasets.value)
    } catch (error) {
      fail(`datasets JSON 无效：${error.message}`)
      return
    }
    const data = await requestJson('/api/demo/staged-dataset/set', {
      method: 'POST',
      body: JSON.stringify({ ...context, datasets })
    })
    setStagedToken(data.token)
    toast(`上传成功：${(data.datasetNames || []).join(', ')}`, 'ok')
  }

  async function stagedEmbed() {
    const context = readContext({ requireReportId: true })
    if (!context || !state.stagedToken) return
    const parameters = collectParameters()
    if (parameters === null) return

    const data = await requestJson('/api/demo/staged-dataset/embed-url', {
      method: 'POST',
      body: JSON.stringify({
        ...context,
        token: state.stagedToken,
        parameters,
        hideToolbar: el.hideToolbar.checked,
        showQueryForm: el.showQueryForm.checked,
        viewMode: el.viewMode.value
      })
    })
    applyEmbedUrl(data.embedUrl)
    updateHeader()
    if (el.autoSubscribe.checked) {
      el.reportFrame.addEventListener('load', subscribeSelectedOnce, { once: true })
    }
  }

  async function stagedClear() {
    const context = readContext()
    if (!context || !state.stagedToken) return
    await requestJson('/api/demo/staged-dataset/clear', {
      method: 'POST',
      body: JSON.stringify({ ...context, token: state.stagedToken })
    })
    toast('token 已清除', 'ok')
    setStagedToken(null)
  }

  // ── 服务端导出 ────────────────────────────────────────────
  function triggerExport(format) {
    const context = readContext({ requireReportId: true })
    if (!context) return
    const parameters = collectParameters()
    if (parameters === null) return

    const search = new URLSearchParams({
      account: context.account,
      userName: context.userName,
      reportId: context.reportId,
      expireMinutes: String(context.expireMinutes),
      parameters: JSON.stringify(parameters)
    })
    const fileName = el.exportFileName.value.trim()
    if (fileName) search.set('fileName', fileName)

    const url = `${backendBase()}/api/demo/export/${format}?${search.toString()}`
    logRequest('Export', url)
    window.open(url, '_blank', 'noopener,noreferrer')
    toast(`已请求 ${format.toUpperCase()} 导出，文件由浏览器下载`)
  }

  // ── 观察窗 / 面板切换 ─────────────────────────────────────
  const INSPECTOR_TITLES = {
    events: '事件日志',
    invoke: '调用结果',
    url: 'embed URL',
    discovery: '发现结果',
    requests: '请求日志'
  }

  function activePane() {
    return document.querySelector(`.pane[data-insp-pane="${state.activeInspector}"]`)
  }

  function switchInspector(name) {
    state.activeInspector = name
    document.querySelectorAll('.tab[data-insp]').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.insp === name)
    })
    document.querySelectorAll('.pane').forEach((pane) => {
      pane.classList.toggle('active', pane.dataset.inspPane === name)
    })
  }

  async function copyText(text) {
    if (!text) {
      toast('没有可复制的内容')
      return
    }
    try {
      // http 非安全上下文下 navigator.clipboard 不存在，退回 execCommand
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        const area = document.createElement('textarea')
        area.value = text
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        area.remove()
      }
      toast('已复制', 'ok')
    } catch (error) {
      toast(`复制失败：${error.message}`, 'danger')
    }
  }

  // ── 弹窗 ──────────────────────────────────────────────────
  function openModal(node) {
    node.hidden = false
  }

  function closeModal(node) {
    node.hidden = true
  }

  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) closeModal(backdrop)
    })
    backdrop.querySelectorAll('[data-close-modal]').forEach((button) => {
      button.addEventListener('click', () => closeModal(backdrop))
    })
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(closeModal)
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      openEmbed().catch((error) => fail(error.message))
    }
  })

  // ── 事件绑定 ──────────────────────────────────────────────
  function guard(handler) {
    return () => {
      Promise.resolve()
        .then(handler)
        .catch((error) => fail(error.message))
    }
  }

  el.loadConfigBtn.addEventListener('click', guard(loadBackendConfig))
  el.openEmbedBtn.addEventListener('click', guard(openEmbed))
  el.reloadEmbedBtn.addEventListener('click', guard(openEmbed))
  el.discoverBtn.addEventListener('click', guard(discoverReports))
  el.pickerFilter.addEventListener('input', renderReportList)

  el.resetStateBtn.addEventListener('click', () => {
    try {
      localStorage.removeItem(STORE_KEY)
    } catch {
      /* 忽略 */
    }
    location.reload()
  })

  document.querySelectorAll('.seg-btn[data-discover]').forEach((button) => {
    button.addEventListener('click', () => {
      state.discoverMode = button.dataset.discover
      document.querySelectorAll('.seg-btn[data-discover]').forEach((other) => {
        other.classList.toggle('active', other === button)
      })
      el.fileTypeField.classList.toggle('hidden', state.discoverMode !== 'type-tree')
      el.tagField.classList.toggle('hidden', state.discoverMode !== 'tag-list')
      saveState()
    })
  })

  document.querySelectorAll('.tab[data-adv]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab[data-adv]').forEach((other) => {
        other.classList.toggle('active', other === tab)
      })
      document.querySelectorAll('[data-adv-pane]').forEach((pane) => {
        pane.classList.toggle('active', pane.dataset.advPane === tab.dataset.adv)
      })
    })
  })

  document.querySelectorAll('.tab[data-insp]').forEach((tab) => {
    tab.addEventListener('click', () => switchInspector(tab.dataset.insp))
  })

  el.inspCopyBtn.addEventListener('click', () => copyText(activePane().textContent))
  el.inspClearBtn.addEventListener('click', () => {
    activePane().textContent = ''
  })
  el.inspExpandBtn.addEventListener('click', () => {
    el.expandTitle.textContent = INSPECTOR_TITLES[state.activeInspector]
    el.expandContent.textContent = activePane().textContent
    openModal(el.expandModal)
  })
  el.expandCopyBtn.addEventListener('click', () => copyText(el.expandContent.textContent))

  el.paramAddBtn.addEventListener('click', () => {
    state.params.push({ key: '', value: '' })
    renderParamRows()
  })
  el.paramJsonBtn.addEventListener('click', toggleParamJson)

  el.subscribeBtn.addEventListener('click', () => {
    const events = selectedEvents()
    if (!events.length) {
      toast('没有勾选任何事件')
      return
    }
    subscribe(events)
  })
  el.subscribeAllBtn.addEventListener('click', () => subscribe(['*']))

  $('invokeSetParamsBtn').addEventListener('click', () =>
    runInvoke('setParameters', (instance) => instance.setParameters(JSON.parse(el.invokeParams.value)))
  )
  $('invokeQueryBtn').addEventListener('click', () => runInvoke('query', (i) => i.query()))
  $('invokeResetBtn').addEventListener('click', () => runInvoke('reset', (i) => i.reset()))
  $('invokeGetStateBtn').addEventListener('click', () => runInvoke('getState', (i) => i.getState()))
  $('invokeGetCellBtn').addEventListener('click', () =>
    runInvoke('getCellValue', (i) => i.getCellValue(el.invokeCellName.value.trim()))
  )
  $('invokeGetCellsBtn').addEventListener('click', () =>
    runInvoke('getCellValues', (i) => i.getCellValues(el.invokeCellName.value.trim()))
  )
  $('invokePrintBtn').addEventListener('click', () => runInvoke('print', (i) => i.print()))
  $('invokeExportBtn').addEventListener('click', () => runInvoke('export', (i) => i.export('excel')))

  el.stagedSetBtn.addEventListener('click', guard(stagedSet))
  el.stagedEmbedBtn.addEventListener('click', guard(stagedEmbed))
  el.stagedClearBtn.addEventListener('click', guard(stagedClear))

  document.querySelectorAll('[data-export]').forEach((button) => {
    button.addEventListener('click', () => triggerExport(button.dataset.export))
  })

  $('helpSignatureBtn').addEventListener('click', () => openModal($('signatureHelpModal')))
  $('helpEventsBtn').addEventListener('click', () => openModal($('eventsHelpModal')))
  $('helpStagedBtn').addEventListener('click', () => openModal($('stagedHelpModal')))

  el.reportFrame.addEventListener('load', () => {
    if (el.viewerStatus.dataset.state === 'loading') {
      // 报表内部还要取数，loaded 事件到达前先给一个中间态
      setViewerState('loading', '已加载，等出数…')
    }
  })

  TEXT_FIELDS.forEach((key) => {
    el[key].addEventListener('change', saveState)
  })
  FLAG_FIELDS.forEach((key) => {
    el[key].addEventListener('change', saveState)
  })
  el.reportId.addEventListener('input', () => {
    updateHeader()
    renderReportList()
  })

  // ── 启动 ──────────────────────────────────────────────────
  restoreState()
  // 页面由 demo 后端自己托管时（/demo/ 下），后端地址必然是当前 origin —— 以它为准，
  // 免得换了端口还得手改。用别的静态服务器单独跑前端时不会命中这个分支。
  if (location.protocol.startsWith('http') && location.pathname.startsWith('/demo')) {
    el.backendBaseUrl.value = location.origin
  }
  renderParamRows()
  renderReportList()
  setStagedToken(null)
  updateHeader()
  el.fileTypeField.classList.toggle('hidden', state.discoverMode !== 'type-tree')
  el.tagField.classList.toggle('hidden', state.discoverMode !== 'tag-list')
  document.querySelectorAll('.seg-btn[data-discover]').forEach((button) => {
    button.classList.toggle('active', button.dataset.discover === state.discoverMode)
  })
  loadBackendConfig().catch(() => {
    /* 启动时的失败已经写进 banner 与请求日志 */
  })
})()
