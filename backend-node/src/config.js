const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

/** 兼容旧交付包里的 MAGIC_REPORT_* 前缀，新配置统一用 SIGHT_REPORT_* */
function readEnv(name) {
  return process.env[`SIGHT_REPORT_${name}`] ?? process.env[`MAGIC_REPORT_${name}`]
}

function readRequired(name) {
  const value = readEnv(name)
  if (!value) {
    throw new Error(
      `缺少必需的环境变量 SIGHT_REPORT_${name}。请复制 .env.example 为 .env 并填写真实值。`
    )
  }
  if (value === 'replace-with-real-secret') {
    throw new Error(`环境变量 SIGHT_REPORT_${name} 还是占位值，请填入真实值。`)
  }
  return value
}

function readPositiveInt(name, fallback) {
  const rawValue = process.env[name]
  if (!rawValue) {
    return fallback
  }

  const parsedValue = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`环境变量 ${name} 必须是正整数`)
  }
  return parsedValue
}

const config = {
  port: readPositiveInt('PORT', 3010),
  baseUrl: readRequired('BASE_URL').replace(/\/+$/, ''),
  appId: readRequired('APP_ID'),
  appSecret: readRequired('APP_SECRET'),
  defaultExpireMinutes: readPositiveInt('DEMO_DEFAULT_EXPIRE_MINUTES', 10),
  maxExpireMinutes: readPositiveInt('DEMO_MAX_EXPIRE_MINUTES', 60),
  // 调用报表系统的超时（毫秒）/ Timeout for every request to Sight Report, in ms
  upstreamTimeoutMs: readPositiveInt('DEMO_UPSTREAM_TIMEOUT_MS', 15000),
  // JSON 请求体上限，暂存数据集上传会用到 / Max JSON body size (staged dataset uploads)
  jsonBodyLimit: process.env.DEMO_JSON_BODY_LIMIT || '10mb'
}

if (config.defaultExpireMinutes > config.maxExpireMinutes) {
  throw new Error('DEMO_DEFAULT_EXPIRE_MINUTES 不能大于 DEMO_MAX_EXPIRE_MINUTES')
}

module.exports = { config }
