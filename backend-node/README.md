# Demo Backend (backend-node)

轻量后端样例 / minimal backend adapter for Sight Report integration.

它只做四件事：保管 `appSecret`、生成签名 URL、代理少量 `/api/embed/*` 调用、托管前端控制台。
**不是**要长成一个业务后端 —— 生产环境请把签名逻辑搬进你自己的服务。

It only does four things: hold `appSecret`, build signed URLs, proxy a few `/api/embed/*` calls,
and serve the static console. It is **not** meant to become a real backend — move the signing
logic into your own service for production.

## 配置 / Configuration

复制 `.env.example` 为 `.env`：

```bash
PORT=3010
SIGHT_REPORT_BASE_URL=http://localhost:9090
SIGHT_REPORT_APP_ID=erp-system
SIGHT_REPORT_APP_SECRET=replace-with-real-secret
DEMO_DEFAULT_EXPIRE_MINUTES=10
DEMO_MAX_EXPIRE_MINUTES=60
# 可选 / optional
DEMO_UPSTREAM_TIMEOUT_MS=15000   # 调用报表系统的超时，超时返回 504
DEMO_JSON_BODY_LIMIT=10mb        # JSON 请求体上限，暂存数据集较大时调高
```

旧交付包里的 `MAGIC_REPORT_*` 前缀仍然兼容，但新配置请统一用 `SIGHT_REPORT_*`。
配置缺失或仍是占位值时，进程会打印一行中文说明并退出，而不是抛栈。

## 运行 / Run

```bash
npm install
npm start          # 或 npm run dev（node --watch 热重载）
npm test           # 签名固定向量 + 上游异常处理，零依赖（node:test）
```

打开 <http://localhost:3010/demo/>。

Docker：

```bash
docker compose up --build
```

（`docker-compose.yml` 的构建上下文是仓库根目录，因为镜像里要一起带上 `frontend-static/`。）

## 源码导览 / Source map

| 文件 | 作用 |
| --- | --- |
| `src/signature-service.js` | **签名算法**：`HMAC-SHA256` + Base64Url，可直接照搬 |
| `src/report-url-service.js` | 拼签名 URL，处理 `parameters` 序列化与空值省略 |
| `src/staged-dataset-service.js` | 外部数据集 `set` / `clear` |
| `src/upstream.js` | 调用报表系统的公共封装：超时、网络错误 / 非 JSON 响应转成 502 / 504 |
| `src/config.js` | 环境变量读取与校验 |
| `src/index.js` | demo 用的 HTTP 接口、上游可达性探测、静态托管、错误处理 |

## 接口 / Endpoints

### `GET /health`

存活检查。

### `GET /demo/`

托管 `frontend-static/` 控制台。

### `GET /api/demo/config`

返回非敏感配置，并顺带探测报表系统是否可达：

```json
{
  "appId": "erp-system",
  "baseUrl": "http://localhost:9090",
  "defaultExpireMinutes": 10,
  "maxExpireMinutes": 60,
  "upstream": { "reachable": true, "status": 401 }
}
```

`upstream.status` 是 401/403 也算可达 —— 说明网络通、只是没带登录态，这正是嵌入场景的常态。

### `POST /api/demo/embed-url`

生成签名嵌入 URL。

```json
{
  "account": "u1001",
  "userName": "Zhang San",
  "reportId": "rpt_sales",
  "parameters": { "year": 2024, "month": 1 },
  "hideToolbar": true,
  "showQueryForm": false,
  "viewMode": "all",
  "zoom": "fitWidth",
  "expireMinutes": 10
}
```

`zoom` 可选：`fitWidth`（适应宽度，整体缩放铺满 iframe 宽度）或 10~300 的百分比（如 `75`）；不传则按查看人上次在工具栏选的比例、再按报表设置。

响应：`{ "embedUrl": "...", "expireAt": 1735660800, "signatureToken": "..." }`

### `GET /api/demo/report/type-tree`

代理 `GET /api/embed/report/type-tree`。

- 必填：`account`、`userName`、`fileType`
- 可选：`reportId`、`expireMinutes`

### `GET /api/demo/report/tag-list`

代理 `GET /api/embed/report/tag-list`。

- 必填：`account`、`userName`、`tag`
- 可选：`reportId`、`expireMinutes`

### `GET /api/demo/export/:format`

代理 `GET /api/embed/export/{pdf|excel|word|csv}`，透传文件流与 `content-disposition`。

- 必填：`account`、`userName`、`reportId`
- 可选：`parameters`、`fileName`、`pageIndex`、`expireMinutes`

### `POST /api/demo/staged-dataset/set`

上传外部数据集，返回 `{ "token": "...", "datasetNames": ["orders"] }`。

```json
{
  "account": "u1001",
  "userName": "Zhang San",
  "reportId": "rpt_sales",
  "expireMinutes": 10,
  "datasets": {
    "orders": [{ "orderId": "ORD-001", "product": "Widget A", "quantity": 10, "price": 99.5 }]
  }
}
```

### `POST /api/demo/staged-dataset/clear`

按 token 主动释放：`{ "account", "userName", "expireMinutes", "token" }`。

### `POST /api/demo/staged-dataset/embed-url`

同 `/api/demo/embed-url`，但会把 `_dataIds: token` 合并进 `parameters`。

## 说明 / Notes

- `SIGHT_REPORT_APP_SECRET` 只在本进程内使用，任何响应都不会带上它
- 样例故意开了 CORS（`Access-Control-Allow-Origin: *`），方便前端从别的本地端口调；生产要收紧
- `requests.http` 可在 VS Code REST Client 里直接跑，用于快速手工验证
- 错误响应统一是 `{ "message": "..." }`；参数问题返回 400，请求体超过 `DEMO_JSON_BODY_LIMIT` 返回 413，
  上游不可达或拒绝返回 502，上游超时返回 504
- `test/signature-service.test.js` 里有一组固定签名向量，用其它语言实现签名时可以拿来对齐
