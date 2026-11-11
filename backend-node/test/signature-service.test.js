const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')
const { buildSignatureToken } = require('../src/signature-service')

const INPUT = {
  appId: 'erp-system',
  appSecret: 'test-secret',
  account: 'u1001',
  userName: '张三',
  reportId: 'r-001',
  expireAt: 1700000000
}

// 固定向量：签名用 Python hmac 独立算过。其它语言的接入方可以拿它对齐实现。
// Fixed vector (signature cross-checked with Python's hmac); use it to verify ports to other languages.
const EXPECTED_SIGNATURE = '383285653dc1ba6d4f919f2aca4ac8ca0f8a49d1b682885cb21d2ff4cd06d307'
const EXPECTED_TOKEN =
  'eyJhcHBJZCI6ImVycC1zeXN0ZW0iLCJhY2NvdW50IjoidTEwMDEiLCJ1c2VyTmFtZSI6IuW8oOS4iSIsInJlcG9ydElkIjoici0wMDEiLCJleHBpcmVBdCI6MTcwMDAwMDAwMCwic2lnbmF0dXJlIjoiMzgzMjg1NjUzZGMxYmE2ZDRmOTE5ZjJhY2E0YWM4Y2EwZjhhNDlkMWI2ODI4ODVjYjIxZDJmZjRjZDA2ZDMwNyJ9'

function decode(token) {
  return JSON.parse(Buffer.from(token, 'base64url').toString('utf8'))
}

test('matches the fixed signature vector', () => {
  assert.equal(buildSignatureToken(INPUT), EXPECTED_TOKEN)
})

test('token is base64url without padding and decodes to the documented payload', () => {
  const token = buildSignatureToken(INPUT)
  assert.match(token, /^[A-Za-z0-9_-]+$/)

  const payload = decode(token)
  assert.deepEqual(Object.keys(payload), [
    'appId',
    'account',
    'userName',
    'reportId',
    'expireAt',
    'signature'
  ])
  assert.equal(payload.expireAt, INPUT.expireAt, 'expireAt stays a number in the payload')
  assert.equal(payload.signature, EXPECTED_SIGNATURE)
  assert.equal('appSecret' in payload, false, 'the secret never appears in the token')
})

test('signs appId|account|userName|reportId|expireAt, with empty reportId allowed', () => {
  const input = { ...INPUT, reportId: '' }
  const expected = crypto
    .createHmac('sha256', input.appSecret)
    .update(['erp-system', 'u1001', '张三', '', '1700000000'].join('|'), 'utf8')
    .digest('hex')

  assert.equal(decode(buildSignatureToken(input)).signature, expected)
})

test('any changed field changes the signature', () => {
  const base = decode(buildSignatureToken(INPUT)).signature
  for (const field of ['appSecret', 'account', 'userName', 'reportId']) {
    const changed = decode(buildSignatureToken({ ...INPUT, [field]: `${INPUT[field]}x` }))
    assert.notEqual(changed.signature, base, field)
  }
  const later = decode(buildSignatureToken({ ...INPUT, expireAt: INPUT.expireAt + 1 }))
  assert.notEqual(later.signature, base, 'expireAt')
})
