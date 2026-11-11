const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const { setStagedDatasets, clearStagedDatasets } = require('../src/staged-dataset-service')

/** 起一个本地假上游，handler 决定返回什么 / Local fake upstream; the handler decides the reply */
async function withUpstream(handler, run) {
  const server = http.createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  try {
    await run(baseUrl)
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
}

function options(baseUrl, extra = {}) {
  return {
    baseUrl,
    appId: 'erp-system',
    appSecret: 'test-secret',
    account: 'u1001',
    userName: 'Alice',
    expireAt: 1700000000,
    datasets: { orders: [{ id: 1 }] },
    ...extra
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

test('returns data and posts the signed payload on success', async () => {
  let received
  await withUpstream(
    (request, response) => {
      let raw = ''
      request.on('data', (chunk) => (raw += chunk))
      request.on('end', () => {
        received = { url: request.url, body: JSON.parse(raw) }
        sendJson(response, 200, { code: 0, data: { token: 'tk-1', datasetNames: ['orders'] } })
      })
    },
    async (baseUrl) => {
      const data = await setStagedDatasets(options(baseUrl))
      assert.deepEqual(data, { token: 'tk-1', datasetNames: ['orders'] })
    }
  )
  assert.equal(received.url, '/api/embed/staged-dataset/set')
  assert.equal(typeof received.body.signature, 'string')
  assert.deepEqual(received.body.datasets, { orders: [{ id: 1 }] })
})

test('upstream rejection becomes a 502 carrying the upstream message', async () => {
  await withUpstream(
    (_request, response) => sendJson(response, 200, { code: 401, msg: 'signature expired' }),
    async (baseUrl) => {
      await assert.rejects(clearStagedDatasets({ ...options(baseUrl), token: 'tk-1' }), {
        statusCode: 502,
        message: 'signature expired'
      })
    }
  )
})

test('non-JSON upstream body becomes a readable 502, not a JSON parse error', async () => {
  await withUpstream(
    (_request, response) => {
      response.writeHead(502, { 'content-type': 'text/html' })
      response.end('<html><body>Bad Gateway</body></html>')
    },
    async (baseUrl) => {
      await assert.rejects(setStagedDatasets(options(baseUrl)), (error) => {
        assert.equal(error.statusCode, 502)
        assert.match(error.message, /非 JSON.*HTTP 502.*Bad Gateway/)
        return true
      })
    }
  )
})

test('a hanging upstream times out with 504', async () => {
  await withUpstream(
    () => {
      /* never respond */
    },
    async (baseUrl) => {
      await assert.rejects(setStagedDatasets(options(baseUrl, { timeoutMs: 200 })), {
        statusCode: 504
      })
    }
  )
})

test('an unreachable upstream becomes a 502', async () => {
  await assert.rejects(setStagedDatasets(options('http://127.0.0.1:1')), (error) => {
    assert.equal(error.statusCode, 502)
    assert.match(error.message, /无法连接报表系统/)
    return true
  })
})
