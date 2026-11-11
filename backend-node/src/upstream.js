/**
 * 调用报表系统（上游）的公共封装：统一超时，并把网络 / 超时 / 非 JSON 响应
 * 转成带 statusCode 的错误，交给全局错误处理返回 502 / 504。
 * Shared helpers for calling Sight Report: one timeout for every request, and
 * network / timeout / non-JSON failures become errors carrying a statusCode (502 / 504).
 */

const DEFAULT_TIMEOUT_MS = 15000

function upstreamError(message, statusCode = 502) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

async function fetchUpstream(url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw upstreamError(`报表系统响应超时（${timeoutMs}ms）`, 504)
    }
    const reason = error.cause?.code || error.cause?.message || error.message
    throw upstreamError(`无法连接报表系统：${reason}`)
  }
}

/** 解析上游 JSON；上游返回 HTML 错误页、空响应等时给出可读的错误，而不是 `Unexpected token <` */
async function readUpstreamJson(response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    const snippet = text.trim().slice(0, 200) || '(empty body)'
    throw upstreamError(`报表系统返回了非 JSON 响应（HTTP ${response.status}）：${snippet}`)
  }
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  upstreamError,
  fetchUpstream,
  readUpstreamJson
}
