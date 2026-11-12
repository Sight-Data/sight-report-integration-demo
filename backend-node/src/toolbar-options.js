'use strict'

/**
 * 工具栏按钮逐个显隐：'-print,-license' 或 ['-print', '+query']；只放行认得出的写法，原样拼到 URL 上。
 * Per-button toolbar visibility: '-id' hides, '+id' (or bare id) shows.
 */
const TOOLBAR_ITEM_IDS = new Set([
  'print', 'continuePrint', 'export', 'viewMode', 'zoom', 'query', 'resetColumnWidths',
  'columns', 'pagination', 'caliber', 'timing', 'license', 'sheetTabs'
])

function normalizeToolbarItems(value) {
  if (value == null || value === '') return undefined
  const parts = (Array.isArray(value) ? value : String(value).split(','))
    .map((part) => String(part).trim())
    .filter((part) => TOOLBAR_ITEM_IDS.has(part.replace(/^[+-]/, '').trim()))
  return parts.length ? parts.join(',') : undefined
}

/**
 * 宿主自定义按钮 → URL 参数 toolbarButtons（JSON → UTF-8 → base64url）。报表侧会再校验一遍字段。
 * Host toolbar buttons, encoded as base64url JSON; the report re-validates every field.
 */
function encodeToolbarButtons(value) {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const buttons = value
    .filter((b) => b && typeof b.id === 'string' && b.id.trim() && typeof b.text === 'string' && b.text.trim())
    .slice(0, 10)
    .map((b) => ({
      id: b.id.trim(),
      text: b.text.trim(),
      ...(b.title ? { title: String(b.title) } : {}),
      ...(b.position === 'right' ? { position: 'right' } : {}),
      ...(b.type === 'primary' ? { type: 'primary' } : {}),
      ...(b.disabled === true ? { disabled: true } : {})
    }))
  return buttons.length ? Buffer.from(JSON.stringify(buttons), 'utf8').toString('base64url') : undefined
}

module.exports = {
  TOOLBAR_ITEM_IDS,
  normalizeToolbarItems,
  encodeToolbarButtons
}
