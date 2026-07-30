const { buildSignatureToken } = require('./signature-service')

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
  datasets
}) {
  const signatureToken = buildSignatureToken({
    appId,
    appSecret,
    account,
    userName,
    reportId,
    expireAt
  })

  const url = `${baseUrl}/api/embed/staged-dataset/set`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signature: signatureToken,
      reportId,
      datasets
    })
  })

  const body = await response.json()
  if (body.code !== 0) {
    throw new Error(body.msg || body.message || 'Failed to set staged datasets')
  }

  return body.data
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
 * @returns {Promise<void>}
 */
async function clearStagedDatasets({
  baseUrl,
  appId,
  appSecret,
  account,
  userName,
  expireAt,
  token
}) {
  const signatureToken = buildSignatureToken({
    appId,
    appSecret,
    account,
    userName,
    reportId: '',
    expireAt
  })

  const url = `${baseUrl}/api/embed/staged-dataset/clear`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signature: signatureToken,
      token
    })
  })

  const body = await response.json()
  if (body.code !== 0) {
    throw new Error(body.msg || body.message || 'Failed to clear staged datasets')
  }
}

module.exports = {
  setStagedDatasets,
  clearStagedDatasets
}
