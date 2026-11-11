const { buildSignatureToken } = require('./signature-service')
const { DEFAULT_TIMEOUT_MS, fetchUpstream, readUpstreamJson, upstreamError } = require('./upstream')

/** 上游约定 `{ code: 0, data }` 为成功；其余视为上游拒绝（签名无效、数据不合法等），返回 502 并透出上游消息 */
async function postEmbedApi(url, payload, timeoutMs, fallbackMessage) {
  const response = await fetchUpstream(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    timeoutMs
  )

  const body = await readUpstreamJson(response)
  if (!body || body.code !== 0) {
    throw upstreamError(body?.msg || body?.message || `${fallbackMessage} (HTTP ${response.status})`)
  }
  return body.data
}

/**
 * Upload staged datasets to Sight Report.
 *
 * @param {object} options
 * @param {string} options.baseUrl      Sight Report base URL
 * @param {string} options.appId        Application ID
 * @param {string} options.appSecret    Application secret
 * @param {string} options.account      User account
 * @param {string} options.userName     User display name
 * @param {string} [options.reportId]   Optional report ID
 * @param {number} options.expireAt     Signature expiration (Unix seconds)
 * @param {object} options.datasets     Map of datasetName → array of row objects
 * @param {number} [options.timeoutMs]  Upstream request timeout in ms
 * @returns {Promise<{token: string, datasetNames: string[]}>}
 */
async function setStagedDatasets({
  baseUrl,
  appId,
  appSecret,
  account,
  userName,
  reportId = '',
  expireAt,
  datasets,
  timeoutMs = DEFAULT_TIMEOUT_MS
}) {
  const signatureToken = buildSignatureToken({
    appId,
    appSecret,
    account,
    userName,
    reportId,
    expireAt
  })

  return postEmbedApi(
    `${baseUrl}/api/embed/staged-dataset/set`,
    { signature: signatureToken, reportId, datasets },
    timeoutMs,
    'Failed to set staged datasets'
  )
}

/**
 * Clear staged dataset by token.
 *
 * @param {object} options
 * @param {string} options.baseUrl
 * @param {string} options.appId
 * @param {string} options.appSecret
 * @param {string} options.account
 * @param {string} options.userName
 * @param {number} options.expireAt
 * @param {string} options.token       Token returned by setStagedDatasets
 * @param {number} [options.timeoutMs] Upstream request timeout in ms
 * @returns {Promise<void>}
 */
async function clearStagedDatasets({
  baseUrl,
  appId,
  appSecret,
  account,
  userName,
  expireAt,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS
}) {
  const signatureToken = buildSignatureToken({
    appId,
    appSecret,
    account,
    userName,
    reportId: '',
    expireAt
  })

  await postEmbedApi(
    `${baseUrl}/api/embed/staged-dataset/clear`,
    { signature: signatureToken, token },
    timeoutMs,
    'Failed to clear staged datasets'
  )
}

module.exports = {
  setStagedDatasets,
  clearStagedDatasets
}
