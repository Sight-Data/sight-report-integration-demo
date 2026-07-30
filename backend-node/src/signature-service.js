const crypto = require('crypto')

function toBase64Url(value) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function signContent(content, appSecret) {
  return crypto.createHmac('sha256', appSecret).update(content, 'utf8').digest('hex')
}

function buildSignatureToken({ appId, appSecret, account, userName, reportId, expireAt }) {
  const signContentValue = [appId, account, userName, reportId, String(expireAt)].join('|')
  const signature = signContent(signContentValue, appSecret)

  const payload = JSON.stringify({
    appId,
    account,
    userName,
    reportId,
    expireAt,
    signature
  })

  return toBase64Url(payload)
}

module.exports = {
  buildSignatureToken
}
