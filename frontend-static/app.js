/*
 * Sight Report 集成控制台 — 零依赖前端（按场景组织）
 *
 * 顶部是六个场景共享的上下文（后端地址、身份、reportId、查询参数），
 * 主体一次只展示一个场景：说明 → 该场景专属字段 → 主操作 → 对应代码 → 结果。
 * 每个场景的「对应代码」都用当前表单里的真实值渲染，可以直接复制进你自己的项目。
 */
;(function () {
  'use strict'

  const PROTOCOL = 'sight-report'
  const STORE_KEY = 'sight-report-integration-demo:v3'

  const SCENES = ['embed', 'events', 'invoke', 'discover', 'export', 'staged']
  /** 每个场景默认想让你看的那个结果面板 */
  const SCENE_INSPECTOR = {
    embed: 'url',
    events: 'events',
    invoke: 'invoke',
    discover: 'discovery',
    export: 'requests',
    staged: 'requests'
  }

  const $ = (id) => document.getElementById(id)

  const el = {
    // 共享上下文
    backendBaseUrl: $('backendBaseUrl'),
    loadConfigBtn: $('loadConfigBtn'),
    resetStateBtn: $('resetStateBtn'),
    backendInfo: $('backendInfo'),
    account: $('account'),
    userName: $('userName'),
    expireMinutes: $('expireMinutes'),
    reportId: $('reportId'),
    paramsToggleBtn: $('paramsToggleBtn'),
    paramsDrawer: $('paramsDrawer'),
    paramCount: $('paramCount'),
    paramRows: $('paramRows'),
    paramJson: $('paramJson'),
    paramError: $('paramError'),
    paramAddBtn: $('paramAddBtn'),
    paramJsonBtn: $('paramJsonBtn'),

    // 顶栏
    pillConnection: $('pillConnection'),
    connectionText: $('connectionText'),
    reportBaseText: $('reportBaseText'),
    appIdText: $('appIdText'),

    // 场景 1
    viewMode: $('viewMode'),
    embedReportMirror: $('embedReportMirror'),
    hideToolbar: $('hideToolbar'),
    showQueryForm: $('showQueryForm'),
    autoSubscribe: $('autoSubscribe'),
    openEmbedBtn: $('openEmbedBtn'),
    reloadEmbedBtn: $('reloadEmbedBtn'),

    // 场景 2
    eventsPrereq: $('eventsPrereq'),
    subQuery: $('subQuery'),
    subQueryDone: $('subQueryDone'),
    subExport: $('subExport'),
    subPrint: $('subPrint'),
    subscribeBtn: $('subscribeBtn'),
    subscribeAllBtn: $('subscribeAllBtn'),

    // 场景 3
    invokePrereq: $('invokePrereq'),
    invokeParams: $('invokeParams'),
    invokeCellName: $('invokeCellName'),

    // 场景 4
    discoverBtn: $('discoverBtn'),
    fileType: $('fileType'),
    fileTypeField: $('fileTypeField'),
    tag: $('tag'),
    tagField: $('tagField'),
    pickerFilter: $('pickerFilter'),
    reportList: $('reportList'),

    // 场景 5
    exportFileName: $('exportFileName'),
    exportPageIndex: $('exportPageIndex'),

    // 场景 6
    stagedDatasets: $('stagedDatasets'),
    stagedStatus: $('stagedStatus'),
    stagedSetBtn: $('stagedSetBtn'),
    stagedEmbedBtn: $('stagedEmbedBtn'),
    stagedClearBtn: $('stagedClearBtn'),

    // 舞台
    reportFrame: $('reportFrame'),
    viewerEmpty: $('viewerEmpty'),
    viewerStatus: $('viewerStatus'),
    openNewWindowLink: $('openNewWindowLink'),

    // 观察窗
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
    scene: 'embed',
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
    appId: '',
    baseUrl: '',
    sdk: null,
    activeInspector: 'url'
  }

  const TEXT_FIELDS = [
    'backendBaseUrl',
    'account',
    'userName',
    'expireMinutes',
    'reportId',
    'viewMode',
    'exportFileName',
    'exportPageIndex',
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

  // ── 本地记忆 ──────────────────────────────────────────────
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

  // ── 输出 ──────────────────────────────────────────────────
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

  // ── 请求 ──────────────────────────────────────────────────
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
    // 业务错误也要让调用方看到原始信封（排查时最有用的就是这段）
    if (typeof options.onRaw === 'function') options.onRaw(data)
    // 代理类接口原样透传报表系统的信封：HTTP 200 里仍可能是业务错误（code !== 0）
    if (data && typeof data === 'object' && 'code' in data && data.code !== 0 && data.success !== true) {
      throw new Error(
        `报表系统拒绝了请求（code ${data.code}）：${data.message || data.msg || '无错误描述'}`
      )
    }
    return data
  }

  // ── 顶栏 / 视图状态 ───────────────────────────────────────
  function setConnection(stateName, text) {
    el.pillConnection.dataset.state = stateName
    el.connectionText.textContent = text
  }

  function setViewerState(stateName, text) {
    el.viewerStatus.dataset.state = stateName
    el.viewerStatus.textContent = text
  }

  function syncSharedMirrors() {
    el.embedReportMirror.value = el.reportId.value.trim() || '（未选择）'
    const count = collectParameters({ silent: true })
    el.paramCount.textContent = count ? String(Object.keys(count).length) : '!'
    const opened = Boolean(state.embedUrl)
    el.eventsPrereq.classList.toggle('hidden', opened)
    el.invokePrereq.classList.toggle('hidden', opened)
    el.reloadEmbedBtn.disabled = !opened
    renderSnippets()
  }

  async function loadBackendConfig() {
    setConnection('unknown', '检测中…')
    try {
      const data = await requestJson('/api/demo/config')
      state.appId = data.appId || ''
      state.baseUrl = data.baseUrl || ''
      el.reportBaseText.textContent = state.baseUrl || '-'
      el.appIdText.textContent = state.appId || '-'
      const reach = data.upstream || {}
      if (reach.reachable === false) {
        setConnection('partial', '后端在，报表系统不通')
        el.backendInfo.className = 'banner warn slim'
        el.backendInfo.textContent =
          `demo 后端正常，但访问不到报表系统 ${state.baseUrl}：${reach.message || '无响应'}。` +
          '请检查地址、端口与网络。'
      } else {
        setConnection('ok', '正常')
        el.backendInfo.className = 'banner ok slim'
        el.backendInfo.textContent =
          `appId ${state.appId} · 报表系统 ${state.baseUrl} · 签名有效期 ` +
          `${data.defaultExpireMinutes}~${data.maxExpireMinutes} 分钟 · appSecret 只在后端`
      }
      renderSnippets()
    } catch (error) {
      setConnection('fail', '连不上')
      el.backendInfo.className = 'banner danger slim'
      el.backendInfo.textContent = error.message
      throw error
    }
  }

  // ── 场景切换（hash 可分享） ───────────────────────────────
  function switchScene(name, options = {}) {
    if (!SCENES.includes(name)) name = 'embed'
    state.scene = name

    document.querySelectorAll('.scene-item[data-scene]').forEach((item) => {
      item.classList.toggle('active', item.dataset.scene === name)
    })
    document.querySelectorAll('[data-scene-pane]').forEach((pane) => {
      pane.classList.toggle('active', pane.dataset.scenePane === name)
    })
    if (location.hash !== `#/${name}`) {
      history.replaceState(null, '', `#/${name}`)
    }
    if (!options.keepInspector) switchInspector(SCENE_INSPECTOR[name])
    syncSharedMirrors()
  }

  // ── 共享上下文读取 ────────────────────────────────────────
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
      fail('请先在「报表发现」里选一个报表，或直接手填 reportId')
      switchScene('discover')
      return null
    }
    return { account, userName, reportId, expireMinutes }
  }

  // ── 参数编辑器（共享） ────────────────────────────────────
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
        syncSharedMirrors()
      })

      const valueInput = document.createElement('input')
      valueInput.type = 'text'
      valueInput.placeholder = '值（数字/布尔/JSON 自动识别）'
      valueInput.value = param.value
      valueInput.addEventListener('input', () => {
        state.params[index].value = valueInput.value
        saveState()
        syncSharedMirrors()
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
        syncSharedMirrors()
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

  function collectParameters(options = {}) {
    if (!options.silent) el.paramError.classList.add('hidden')
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
        if (!options.silent) {
          el.paramError.textContent = `参数 JSON 无效：${error.message}`
          el.paramError.classList.remove('hidden')
        }
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
    syncSharedMirrors()
  }

  // ── 代码片段：用当前表单里的真实值渲染 ────────────────────
  function snippetContext() {
    const context = {
      account: el.account.value.trim() || 'u1001',
      userName: el.userName.value.trim() || '张三',
      reportId: el.reportId.value.trim() || 'rpt_sales',
      expireMinutes: Number.parseInt(el.expireMinutes.value, 10) || 10,
      appId: state.appId || 'your-app-id',
      baseUrl: state.baseUrl || 'https://your-report-host',
      origin: state.reportOrigin || state.baseUrl || 'https://your-report-host'
    }
    const parameters = collectParameters({ silent: true }) || {}
    return { ...context, parameters }
  }

  const SIGN_HELPER = [
    "const crypto = require('crypto')",
    '',
    'function buildSignature({ appId, appSecret, account, userName, reportId, expireAt }) {',
    "  const signContent = [appId, account, userName, reportId || '', String(expireAt)].join('|')",
    "  const signature = crypto.createHmac('sha256', appSecret).update(signContent, 'utf8').digest('hex')",
    '  const payload = JSON.stringify({ appId, account, userName, reportId, expireAt, signature })',
    "  return Buffer.from(payload, 'utf8').toString('base64')",
    "    .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '')   // Base64Url，无填充",
    '}'
  ].join('\n')

  function renderSnippets() {
    const c = snippetContext()
    const paramsText = JSON.stringify(c.parameters)

    $('snippetEmbed').textContent = [
      '// ① 你的后端（appSecret 只到这一层为止）',
      SIGN_HELPER,
      '',
      'app.get("/my-backend/embed-url", (req, res) => {',
      '  const expireAt = Math.floor(Date.now() / 1000) + ' + c.expireMinutes + ' * 60',
      '  const _s = buildSignature({',
      '    appId: ' + JSON.stringify(c.appId) + ', appSecret: process.env.SIGHT_REPORT_APP_SECRET,',
      '    account: ' + JSON.stringify(c.account) + ', userName: ' + JSON.stringify(c.userName) + ',',
      '    reportId: ' + JSON.stringify(c.reportId) + ', expireAt',
      '  })',
      '',
      '  const query = new URLSearchParams({',
      '    reportId: ' + JSON.stringify(c.reportId) + ',',
      '    _s,',
      '    parameters: ' + JSON.stringify(paramsText) + ',',
      '    hideToolbar: ' + String(el.hideToolbar.checked) + ',',
      '    showQueryForm: ' + String(el.showQueryForm.checked) + ',',
      '    viewMode: ' + JSON.stringify(el.viewMode.value),
      '  })',
      '  res.send(' + JSON.stringify(c.baseUrl + '/embed.html?') + ' + query.toString())',
      '})',
      '',
      '// ② 你的前端：只拿 URL，不参与签名',
      "const embedUrl = await fetch('/my-backend/embed-url').then((r) => r.text())",
      "document.getElementById('reportFrame').src = embedUrl"
    ].join('\n')

    $('snippetEvents').textContent = [
      '// ① 零配置监听：loaded / error / 自定义单元格事件',
      "window.addEventListener('message', (event) => {",
      '  if (event.origin !== ' + JSON.stringify(c.origin) + ') return   // 校验来源',
      "  if (event.data?.protocol !== 'sight-report') return    // 校验协议命名空间",
      '',
      '  const { name, payload, source } = event.data',
      '  switch (name) {',
      "    case 'report:loaded':",
      "      console.log('报表就绪', payload.elapsedMs, 'ms')",
      '      break',
      "    case 'report:error':",
      "      console.error('报表出错', payload.phase, payload.message)",
      '      break',
      "    case 'order-selected':          // 设计器「发送事件」里自定义的名字",
      '      openOrderDetail(payload.orderId)   // source.cid 区分展开后第几行',
      '      break',
      '  }',
      '})',
      '',
      '// ② 订阅过程性事件（不订阅就不发）',
      "const frame = document.getElementById('reportFrame')",
      "frame.addEventListener('load', () => {",
      '  frame.contentWindow.postMessage({',
      "    protocol: 'sight-report',",
      "    type: 'subscribe',",
      '    events: ' + JSON.stringify(selectedEvents()) + '   // 或 ["*"]',
      '  }, ' + JSON.stringify(c.origin) + ')',
      '})'
    ].join('\n')

    $('snippetInvoke').textContent = [
      '// 引入 sight-report-embed.js（零依赖 UMD，附 .d.ts）',
      "const report = SightReportEmbed.mount('#reportBox', {",
      "  getEmbedUrl: () => fetch('/my-backend/embed-url').then((r) => r.text())",
      '})',
      '// 已有 iframe 元素时：SightReportEmbed.connect(iframeEl)',
      '',
      'await report.ready()                       // loaded 事件 + getState 轮询兜底',
      "report.on('report:query-done', (e) => console.log(e.payload.elapsedMs))",
      '',
      'await report.setParameters(' + (el.invokeParams.value.trim() || '{}') + ')   // 合并参数并重新出数',
      'const state = await report.getState()      // 参数/变量/页码/加载状态',
      'const cell  = await report.getCellValue(' + JSON.stringify(el.invokeCellName.value.trim() || 'A1') + ')',
      "await report.export('excel')               // 受理即回，完成看 report:export",
      '',
      '// 其他：query / reset / print / setSheet / getCellValues / invoke(method, ...args)'
    ].join('\n')

    const discoverByTag = state.discoverMode === 'tag-list'
    $('snippetDiscover').textContent = [
      '// 报表发现：签名里的 reportId 留空 → 返回白名单范围内全部结果',
      SIGN_HELPER,
      '',
      'const expireAt = Math.floor(Date.now() / 1000) + ' + c.expireMinutes + ' * 60',
      'const _s = buildSignature({',
      '  appId: ' + JSON.stringify(c.appId) + ', appSecret: process.env.SIGHT_REPORT_APP_SECRET,',
      '  account: ' + JSON.stringify(c.account) + ', userName: ' + JSON.stringify(c.userName) + ',',
      "  reportId: '', expireAt          // ← 刻意留空",
      '})',
      '',
      discoverByTag
        ? 'const url = ' +
          JSON.stringify(c.baseUrl + '/api/embed/report/tag-list?_s=') +
          " + _s + '&tag=' + encodeURIComponent(" +
          JSON.stringify(el.tag.value.trim() || 'monthly') +
          ')'
        : 'const url = ' +
          JSON.stringify(c.baseUrl + '/api/embed/report/type-tree?_s=') +
          " + _s + '&fileType=' + " +
          JSON.stringify(el.fileType.value),
      'const result = await fetch(url).then((r) => r.json())',
      '// result.code === 0 才是成功；HTTP 200 也可能是业务错误',
      'console.log(result.data)'
    ].join('\n')

    const pageIndex = el.exportPageIndex.value.trim()
    const fileName = el.exportFileName.value.trim()
    $('snippetExport').textContent = [
      '// 服务端导出：签名 reportId 必须与 fileId 一致，且不可留空',
      SIGN_HELPER,
      '',
      'const expireAt = Math.floor(Date.now() / 1000) + ' + c.expireMinutes + ' * 60',
      'const _s = buildSignature({',
      '  appId: ' + JSON.stringify(c.appId) + ', appSecret: process.env.SIGHT_REPORT_APP_SECRET,',
      '  account: ' + JSON.stringify(c.account) + ', userName: ' + JSON.stringify(c.userName) + ',',
      '  reportId: ' + JSON.stringify(c.reportId) + ', expireAt',
      '})',
      '',
      'const query = new URLSearchParams({',
      '  fileId: ' + JSON.stringify(c.reportId) + ',   // 与签名里的 reportId 相同',
      '  _s,',
      '  parameters: ' + JSON.stringify(paramsText) + (fileName || pageIndex ? ',' : ''),
      ...(fileName ? ['  fileName: ' + JSON.stringify(fileName) + (pageIndex ? ',' : '')] : []),
      ...(pageIndex ? ['  pageIndex: ' + JSON.stringify(pageIndex)] : []),
      '})',
      '',
      'const response = await fetch(',
      '  ' + JSON.stringify(c.baseUrl + '/api/embed/export/excel?') + " + query.toString()",
      ')',
      'const buffer = Buffer.from(await response.arrayBuffer())   // 落盘 / 邮件 / 归档',
      '// 格式换成 pdf | excel | word | csv 即可'
    ].join('\n')

    $('snippetStaged').textContent = [
      '// ① 上传数据，拿 token',
      'const setResult = await fetch(' + JSON.stringify(c.baseUrl + '/api/embed/staged-dataset/set') + ', {',
      "  method: 'POST',",
      "  headers: { 'Content-Type': 'application/json' },",
      '  body: JSON.stringify({',
      '    signature: _s,                    // 与嵌入报表同一套签名',
      '    reportId: ' + JSON.stringify(c.reportId) + ',',
      '    datasets: ' + (el.stagedDatasets.value.trim() || '{}'),
      '  })',
      '}).then((r) => r.json())',
      '',
      'const token = setResult.data.token',
      '',
      '// ② 把 token 放进 parameters 的 _dataIds，再生成嵌入 URL / 导出',
      'const parameters = { ...' + paramsText + ', _dataIds: token }',
      '',
      '// ③ 用完可主动释放（不释放也会在 24 小时后过期）',
      'await fetch(' + JSON.stringify(c.baseUrl + '/api/embed/staged-dataset/clear') + ', {',
      "  method: 'POST',",
      "  headers: { 'Content-Type': 'application/json' },",
      '  body: JSON.stringify({ signature: _s, token })',
      '})'
    ].join('\n')
  }

  // ── 场景 1：嵌入查看 ──────────────────────────────────────
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
    setViewerState('loading', '加载中…')

    if (state.sdk) {
      try {
        state.sdk.destroy()
      } catch {
        /* 忽略 */
      }
      state.sdk = null
    }
    syncSharedMirrors()
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
    saveState()
    if (el.autoSubscribe.checked) {
      // iframe 加载完成后再订阅，否则报表侧还没挂上监听
      el.reportFrame.addEventListener('load', subscribeSelectedOnce, { once: true })
    }
  }

  // ── 场景 2：事件 ──────────────────────────────────────────
  window.addEventListener('message', (event) => {
    const data = event.data
    if (!data || data.protocol !== PROTOCOL) return
    if (data.type === 'subscribe' || data.type === 'invoke' || data.type === 'invoke-result') return
    if (state.reportOrigin && event.origin !== state.reportOrigin) return

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

  function subscribeSelectedOnce() {
    const events = selectedEvents()
    if (events.length) subscribe(events, { silent: true })
  }

  function subscribe(events, options = {}) {
    const frameWindow = el.reportFrame.contentWindow
    if (!state.embedUrl || !frameWindow) {
      fail('请先在场景 1 打开报表，再订阅事件')
      switchScene('embed')
      return
    }
    const targetOrigin = state.reportOrigin || '*'
    frameWindow.postMessage({ protocol: PROTOCOL, type: 'subscribe', events }, targetOrigin)
    logRequest('Subscribe', `events: ${JSON.stringify(events)}\ntargetOrigin: ${targetOrigin}`)
    if (!options.silent) toast(`已订阅：${events.join(', ')}`, 'ok')
  }

  // ── 场景 3：宿主调用（SDK） ───────────────────────────────
  function sdk() {
    if (!state.embedUrl) {
      fail('请先在场景 1 打开报表')
      switchScene('embed')
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

  // ── 场景 4：报表发现 ──────────────────────────────────────
  function looksLikeReport(node) {
    const hasId = node.id != null || node.fileId != null
    const hasName = node.name || node.title || node.fileName || node.label
    const children = node.children || node.childList || node.nodes
    return hasId && hasName && !(Array.isArray(children) && children.length)
  }

  /** 目录树结构随版本可能变化，这里做防御式遍历，原始 JSON 仍留在「发现结果」 */
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
        '<div class="empty-hint">还没加载。点「加载列表」后，选中的报表会写进上方共享的' +
        ' <code>reportId</code>，其他场景直接可用。原始 JSON 在右下「发现结果」。</div>'
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
        saveState()
        renderReportList()
        syncSharedMirrors()
        toast(`已选择：${item.name} —— 可以去场景 1 打开了`, 'ok')
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

    // 成功失败都把原始信封摊到「发现结果」，排查时最有用的就是这段
    const data = await requestJson(path, {
      onRaw: (raw) => {
        el.paneDiscovery.textContent = JSON.stringify(raw, null, 2)
        switchInspector('discovery')
      }
    })

    state.reports = flattenReports(data)
    renderReportList()
    if (!state.reports.length) {
      toast('接口通了但没识别出报表条目，请看「发现结果」原始 JSON', 'danger')
    } else {
      toast(`发现 ${state.reports.length} 个报表`, 'ok')
    }
  }

  // ── 场景 5：服务端导出 ────────────────────────────────────
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
    const pageIndex = el.exportPageIndex.value.trim()
    if (pageIndex) search.set('pageIndex', pageIndex)

    const url = `${backendBase()}/api/demo/export/${format}?${search.toString()}`
    logRequest('Export', url)
    switchInspector('requests')
    window.open(url, '_blank', 'noopener,noreferrer')
    toast(`已请求 ${format.toUpperCase()} 导出，文件由浏览器下载`)
  }

  // ── 场景 6：外部数据集 ────────────────────────────────────
  function setStagedToken(token) {
    state.stagedToken = token
    const has = Boolean(token)
    el.stagedEmbedBtn.disabled = !has
    el.stagedClearBtn.disabled = !has
    el.stagedStatus.className = has ? 'banner ok' : 'banner neutral'
    el.stagedStatus.textContent = has ? `token: ${token}（预览时会作为 _dataIds 带上）` : '未上传'
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

  // ── 观察窗 ────────────────────────────────────────────────
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
      // http 非安全上下文下 navigator.clipboard 是 undefined，退回 execCommand
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

  document.querySelectorAll('.scene-item[data-scene]').forEach((item) => {
    item.addEventListener('click', () => switchScene(item.dataset.scene))
  })
  document.querySelectorAll('[data-goto-scene]').forEach((button) => {
    button.addEventListener('click', () => switchScene(button.dataset.gotoScene))
  })
  window.addEventListener('hashchange', () => {
    switchScene((location.hash || '').replace('#/', ''))
  })

  el.loadConfigBtn.addEventListener('click', guard(loadBackendConfig))
  el.resetStateBtn.addEventListener('click', () => {
    try {
      localStorage.removeItem(STORE_KEY)
    } catch {
      /* 忽略 */
    }
    location.reload()
  })

  el.paramsToggleBtn.addEventListener('click', () => {
    el.paramsDrawer.classList.toggle('hidden')
  })
  el.paramAddBtn.addEventListener('click', () => {
    state.params.push({ key: '', value: '' })
    renderParamRows()
  })
  el.paramJsonBtn.addEventListener('click', toggleParamJson)

  el.openEmbedBtn.addEventListener('click', guard(openEmbed))
  el.reloadEmbedBtn.addEventListener('click', guard(openEmbed))

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

  el.discoverBtn.addEventListener('click', guard(discoverReports))
  el.pickerFilter.addEventListener('input', renderReportList)
  document.querySelectorAll('.seg-btn[data-discover]').forEach((button) => {
    button.addEventListener('click', () => {
      state.discoverMode = button.dataset.discover
      document.querySelectorAll('.seg-btn[data-discover]').forEach((other) => {
        other.classList.toggle('active', other === button)
      })
      el.fileTypeField.classList.toggle('hidden', state.discoverMode !== 'type-tree')
      el.tagField.classList.toggle('hidden', state.discoverMode !== 'tag-list')
      saveState()
      renderSnippets()
    })
  })

  document.querySelectorAll('[data-export]').forEach((button) => {
    button.addEventListener('click', () => triggerExport(button.dataset.export))
  })

  el.stagedSetBtn.addEventListener('click', guard(stagedSet))
  el.stagedEmbedBtn.addEventListener('click', guard(stagedEmbed))
  el.stagedClearBtn.addEventListener('click', guard(stagedClear))

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

  document.querySelectorAll('[data-copy-snippet]').forEach((button) => {
    button.addEventListener('click', () => copyText($(button.dataset.copySnippet).textContent))
  })

  $('helpSignatureBtn').addEventListener('click', () => openModal($('signatureHelpModal')))
  $('helpEventsBtn').addEventListener('click', () => openModal($('eventsHelpModal')))
  $('helpStagedBtn').addEventListener('click', () => openModal($('stagedHelpModal')))

  el.reportFrame.addEventListener('load', () => {
    if (el.viewerStatus.dataset.state === 'loading') {
      // 报表内部还要取数，loaded 事件到达前先给个中间态
      setViewerState('loading', '已加载，等出数…')
    }
  })

  TEXT_FIELDS.forEach((key) => {
    el[key].addEventListener('change', () => {
      saveState()
      syncSharedMirrors()
    })
  })
  FLAG_FIELDS.forEach((key) => {
    el[key].addEventListener('change', () => {
      saveState()
      renderSnippets()
    })
  })
  el.reportId.addEventListener('input', () => {
    renderReportList()
    syncSharedMirrors()
  })

  // ── 启动 ──────────────────────────────────────────────────
  restoreState()
  // 页面由 demo 后端自己托管时（/demo/ 下），后端地址必然是当前 origin —— 以它为准
  if (location.protocol.startsWith('http') && location.pathname.startsWith('/demo')) {
    el.backendBaseUrl.value = location.origin
  }
  renderParamRows()
  renderReportList()
  setStagedToken(null)
  el.fileTypeField.classList.toggle('hidden', state.discoverMode !== 'type-tree')
  el.tagField.classList.toggle('hidden', state.discoverMode !== 'tag-list')
  document.querySelectorAll('.seg-btn[data-discover]').forEach((button) => {
    button.classList.toggle('active', button.dataset.discover === state.discoverMode)
  })
  switchScene((location.hash || '').replace('#/', ''))
  loadBackendConfig().catch(() => {
    /* 失败详情已经写进 banner 与请求日志 */
  })
})()
