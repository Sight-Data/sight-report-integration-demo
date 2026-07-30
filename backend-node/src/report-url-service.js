const { buildSignatureToken } = require('./signature-service')

function normalizeParameters(parameters) {
  if (parameters == null || parameters === '') {
    return null
  }
  return typeof parameters === 'string' ? parameters : JSON.stringify(parameters)
}

function appendIfPresent(searchParams, key, value) {
  if (value == null || value === '') {
    return
  }
  searchParams.set(key, String(value))
}

function createSignedUrl({
  baseUrl,
  appId,
  appSecret,
  account,
  userName,
  reportId,
  expireAt,
  path,
  query = {}
}) {
  const signatureToken = buildSignatureToken({
    appId,
    appSecret,
    account,
    userName,
    reportId,
    expireAt
  })

  const url = new URL(path, `${baseUrl}/`)
  url.searchParams.set('_s', signatureToken)

  Object.entries(query).forEach(([key, value]) => {
    if (key === 'parameters') {
      appendIfPresent(url.searchParams, key, normalizeParameters(value))
      return
    }
    appendIfPresent(url.searchParams, key, value)
  })

  return {
    url,
    signatureToken,
    expireAt
  }
}

module.exports = {
  createSignedUrl
}
