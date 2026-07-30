const path = require('path')
const express = require('express')

let config
try {
  config = require('./config').config
} catch (error) {
  console.error(`\n[配置错误] ${error.message}\n`)
  process.exit(1)
}

const { createSignedUrl } = require('./report-url-service')
const { setStagedDatasets, clearStagedDatasets } = require('./staged-dataset-service')

const app = express()
const frontendStaticDir = path.resolve(__dirname, '../../frontend-static')

app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')

  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return
  }

  next()
})

app.use(express.json())
app.use('/demo', express.static(frontendStaticDir))

function parseExpireMinutes(value) {
  if (value == null || value === '') {
    return config.defaultExpireMinutes
  }

  const parsedValue = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw badRequest('expireMinutes must be a positive integer')
  }
  if (parsedValue > config.maxExpireMinutes) {
    throw badRequest(`expireMinutes must be <= ${config.maxExpireMinutes}`)
  }
  return parsedValue
}

function badRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function requireString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`${fieldName} is required`)
  }
  return value.trim()
}

function normalizeViewMode(value) {
  return value === 'all' ? 'all' : 'pagination'
}

function getSignedRequestContext(input, reportIdFallback = '') {
  const account = requireString(input.account, 'account')
  const userName = requireString(input.userName, 'userName')
  const reportId = typeof input.reportId === 'string' ? input.reportId.trim() : reportIdFallback
  const expireMinutes = parseExpireMinutes(input.expireMinutes)
  const expireAt = Math.floor(Date.now() / 1000) + expireMinutes * 60

  return {
    account,
    userName,
    reportId,
    expireAt
  }
}

function buildEmbedResponse(body) {
  const context = getSignedRequestContext(body, '')
  const reportId = requireString(body.reportId, 'reportId')
  const { url, signatureToken, expireAt } = createSignedUrl({
    baseUrl: config.baseUrl,
    appId: config.appId,
    appSecret: config.appSecret,
    account: context.account,
    userName: context.userName,
    reportId,
    expireAt: context.expireAt,
    path: 'embed.html',
    query: {
      reportId,
      parameters: body.parameters,
      hideToolbar: body.hideToolbar,
      showQueryForm: body.showQueryForm,
      viewMode: normalizeViewMode(body.viewMode)
    }
  })

  return {
    embedUrl: url.toString(),
    expireAt,
    signatureToken
  }
}

async function proxyJson(url) {
  const response = await fetch(url)
  const contentType = response.headers.get('content-type') || 'application/json'
  const responseBody = await response.text()

  return {
    ok: response.ok,
    status: response.status,
    contentType,
    responseBody
  }
}

async function proxyBinary(url, response) {
  const upstreamResponse = await fetch(url)
  const arrayBuffer = await upstreamResponse.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  response.status(upstreamResponse.status)
  const contentType = upstreamResponse.headers.get('content-type')
  const disposition = upstreamResponse.headers.get('content-disposition')

  if (contentType) {
    response.setHeader('content-type', contentType)
  }
  if (disposition) {
    response.setHeader('content-disposition', disposition)
  }

  response.send(buffer)
}

/**
 * 探测报表系统是否可达。用 /api/version 是因为它一定存在；
 * 401/403 也算「可达」——说明网络通、只是没带登录态，这正是嵌入场景的常态。
 */
async function checkUpstream() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(`${config.baseUrl}/api/version`, { signal: controller.signal })
    return { reachable: true, status: response.status }
  } catch (error) {
    const aborted = error.name === 'AbortError'
    return {
      reachable: false,
      message: aborted ? '连接超时（4s）' : error.message
    }
  } finally {
    clearTimeout(timer)
  }
}

app.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    appId: config.appId,
    baseUrl: config.baseUrl
  })
})

app.get('/', (_request, response) => {
  response.redirect('/demo/')
})

app.get('/api/demo/config', async (_request, response) => {
  response.json({
    appId: config.appId,
    baseUrl: config.baseUrl,
    defaultExpireMinutes: config.defaultExpireMinutes,
    maxExpireMinutes: config.maxExpireMinutes,
    upstream: await checkUpstream()
  })
})

app.post('/api/demo/embed-url', (request, response, next) => {
  try {
    response.json(buildEmbedResponse(request.body))
  } catch (error) {
    next(error)
  }
})

app.get('/api/demo/report/type-tree', async (request, response, next) => {
  try {
    const context = getSignedRequestContext(request.query, '')
    const { url } = createSignedUrl({
      baseUrl: config.baseUrl,
      appId: config.appId,
      appSecret: config.appSecret,
      account: context.account,
      userName: context.userName,
      reportId: context.reportId,
      expireAt: context.expireAt,
      path: 'api/embed/report/type-tree',
      query: {
        fileType: requireString(request.query.fileType, 'fileType')
      }
    })

    const result = await proxyJson(url)
    response.status(result.status).type(result.contentType).send(result.responseBody)
  } catch (error) {
    next(error)
  }
})

app.get('/api/demo/report/tag-list', async (request, response, next) => {
  try {
    const context = getSignedRequestContext(request.query, '')
    const { url } = createSignedUrl({
      baseUrl: config.baseUrl,
      appId: config.appId,
      appSecret: config.appSecret,
      account: context.account,
      userName: context.userName,
      reportId: context.reportId,
      expireAt: context.expireAt,
      path: 'api/embed/report/tag-list',
      query: {
        tag: requireString(request.query.tag, 'tag')
      }
    })

    const result = await proxyJson(url)
    response.status(result.status).type(result.contentType).send(result.responseBody)
  } catch (error) {
    next(error)
  }
})

app.get('/api/demo/export/:format', async (request, response, next) => {
  try {
    const reportId = requireString(request.query.reportId, 'reportId')
    const format = requireString(request.params.format, 'format')
    const supportedFormats = new Set(['pdf', 'excel', 'word', 'csv'])
    if (!supportedFormats.has(format)) {
      throw new Error(`Unsupported export format: ${format}`)
    }

    const context = getSignedRequestContext({ ...request.query, reportId }, reportId)
    const { url } = createSignedUrl({
      baseUrl: config.baseUrl,
      appId: config.appId,
      appSecret: config.appSecret,
      account: context.account,
      userName: context.userName,
      reportId,
      expireAt: context.expireAt,
      path: `api/embed/export/${format}`,
      query: {
        fileId: reportId,
        parameters: request.query.parameters,
        fileName: request.query.fileName,
        pageIndex: request.query.pageIndex
      }
    })

    await proxyBinary(url, response)
  } catch (error) {
    next(error)
  }
})

// ── Staged Dataset ──────────────────────────────────────────

app.post('/api/demo/staged-dataset/set', async (request, response, next) => {
  try {
    const context = getSignedRequestContext(request.body, request.body.reportId || '')
    const datasets = request.body.datasets
    if (!datasets || typeof datasets !== 'object' || Object.keys(datasets).length === 0) {
      throw new Error('datasets is required and must be a non-empty object')
    }

    const data = await setStagedDatasets({
      baseUrl: config.baseUrl,
      appId: config.appId,
      appSecret: config.appSecret,
      account: context.account,
      userName: context.userName,
      reportId: request.body.reportId || '',
      expireAt: context.expireAt,
      datasets
    })

    response.json(data)
  } catch (error) {
    next(error)
  }
})

app.post('/api/demo/staged-dataset/clear', async (request, response, next) => {
  try {
    const context = getSignedRequestContext(request.body, '')
    const token = requireString(request.body.token, 'token')

    await clearStagedDatasets({
      baseUrl: config.baseUrl,
      appId: config.appId,
      appSecret: config.appSecret,
      account: context.account,
      userName: context.userName,
      expireAt: context.expireAt,
      token
    })

    response.json({ success: true })
  } catch (error) {
    next(error)
  }
})

app.post('/api/demo/staged-dataset/embed-url', (request, response, next) => {
  try {
    const token = requireString(request.body.token, 'token')
    const reportId = requireString(request.body.reportId, 'reportId')

    // Merge _dataIds into the parameters object
    const params = { ...(request.body.parameters || {}), _dataIds: token }

    const body = {
      ...request.body,
      reportId,
      parameters: params
    }

    response.json(buildEmbedResponse(body))
  } catch (error) {
    next(error)
  }
})

app.use((error, _request, response, _next) => {
  const status =
    error.statusCode || (error.message && error.message.includes('required') ? 400 : 500)
  if (status >= 500) console.error('[demo-backend]', error)
  response.status(status).json({
    message: error.message || 'Unexpected error'
  })
})

app.listen(config.port, () => {
  console.log('')
  console.log('  Sight Report 集成 demo 后端已启动')
  console.log(`  控制台      http://localhost:${config.port}/demo/`)
  console.log(`  报表系统    ${config.baseUrl}`)
  console.log(`  appId       ${config.appId}`)
  console.log('  appSecret   仅在本进程内使用，不会下发到浏览器')
  console.log('')
})
