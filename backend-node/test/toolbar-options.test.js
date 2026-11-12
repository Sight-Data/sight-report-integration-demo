const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeToolbarItems, encodeToolbarButtons } = require('../src/toolbar-options')

test('normalizeToolbarItems keeps known ids with -/+ and drops the rest', () => {
  assert.equal(normalizeToolbarItems(' -print, +query ,nope,license'), '-print,+query,license')
  assert.equal(normalizeToolbarItems(['-timing', 'bad']), '-timing')
  assert.equal(normalizeToolbarItems(''), undefined)
  assert.equal(normalizeToolbarItems('nope'), undefined)
})

test('encodeToolbarButtons emits base64url JSON (UTF-8) and filters invalid buttons', () => {
  const encoded = encodeToolbarButtons([
    { id: 'approve', text: '提交审批', type: 'primary', extra: 'x' },
    { id: '', text: 'no id' },
    { id: 'help', text: '帮助', position: 'right' }
  ])
  assert.doesNotMatch(encoded, /[+/=]/)
  assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')), [
    { id: 'approve', text: '提交审批', type: 'primary' },
    { id: 'help', text: '帮助', position: 'right' }
  ])
  assert.equal(encodeToolbarButtons([]), undefined)
  assert.equal(encodeToolbarButtons('x'), undefined)
})
