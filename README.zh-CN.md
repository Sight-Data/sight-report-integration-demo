# Sight Report 集成示例（sight-report-integration-demo）

[English](./README.md) · 简体中文

把 **Sight Report** 报表嵌进你自己的系统，需要的全部东西都在这个仓库里：一个替你保管
`appSecret` 并生成签名的**后端样例**，一个零依赖的**前端控制台**，以及一个零依赖的
**宿主 SDK**（`sight-report-embed.js`）。

不需要报表系统源码，也不需要构建工具，`npm install && npm start` 就能跑。

```
第三方业务前端                  第三方后端（本仓库 backend-node）          Sight Report
────────────────               ─────────────────────────────            ─────────────
点开某张报表        ──────▶     用 appSecret 做 HMAC-SHA256 签名
                                生成 embed URL（不含明文密钥）
   iframe.src = embedUrl  ◀──── 返回 URL
   ├─ 加载报表  ─────────────────────────────────────────────────▶  校验签名并渲染
   ├─ 收事件    ◀────── postMessage: report:loaded / 单元格事件 ─────  报表页面
   └─ 调方法    ─────── postMessage: invoke setParameters ──────▶
服务端导出 / 外部数据集  ──────▶ 同样的签名 ────────────────────────▶  /api/embed/*
```

## 目录

- [截图](#截图)
- [快速开始](#快速开始)
- [目录结构](#目录结构)
- [集成说明](#集成说明)
  - [签名规则](#签名规则公共)
  - [场景一：嵌入查看报表](#场景一嵌入查看报表)
  - [场景二：接收报表事件](#场景二接收报表事件)
  - [场景三：宿主调用报表方法（SDK）](#场景三宿主调用报表方法sdk)
  - [场景四：获取报表列表](#场景四获取报表列表)
  - [场景五：服务端直接导出](#场景五服务端直接导出)
  - [场景六：外部数据集](#场景六外部数据集)
- [Demo 后端接口一览](#demo-后端接口一览)
- [上生产前的检查清单](#上生产前的检查清单)
- [排查常见问题](#排查常见问题)
- [许可](#许可)

## 截图

**场景 1 · 嵌入查看报表** —— 左侧场景面板、中间嵌入的报表、右下是后端刚签出的 embed URL：

![集成控制台：嵌入查看报表](docs/screenshots/console.png)

**场景 2 · 接收报表事件** —— 点报表里配了「发送事件」的单元格，宿主收到自定义事件与 payload：

![接收报表事件](docs/screenshots/events.png)

**场景 3 · 宿主调用报表** —— 通过 SDK 调 `getState` / `getCellValue`，返回值进「调用结果」：

![宿主调用报表](docs/screenshots/invoke.png)

<details>
<summary>更多截图：报表发现 / 外部数据集 / 报表本体</summary>

**场景 4 · 报表发现**：目录树结果被扁平成可点列表，选中即写回共享 `reportId`，原始 JSON 留在「发现结果」。

![报表发现](docs/screenshots/discover.png)

**场景 6 · 外部数据集**：上传数据拿到 token，预览时作为 `_dataIds` 带上。

![外部数据集](docs/screenshots/staged.png)

**嵌入的报表本体**（新窗口打开的效果）：

![嵌入的报表](docs/screenshots/embedded-report.png)

</details>

> 关于截图：控制台、签名链路、事件与 invoke 协议都是**真实运行**的；报表内容是**演示用示例数据**，
> 由一个本地 mock 报表服务渲染（不含任何真实业务数据）。你接上自己的 Sight Report
> 部署后，中间那块就是你自己的报表。

## 快速开始

**前置条件**

1. 一个可访问的 Sight Report 部署地址
2. 在报表系统里 **系统管理 → 第三方应用 → 新增应用**，拿到 `appId` 与 `appSecret`
   （`appSecret` 只显示一次，请当场保存）
3. Node.js ≥ 18（用到了内置 `fetch`）

**跑起来**

```bash
cd backend-node
cp .env.example .env      # 填 SIGHT_REPORT_BASE_URL / APP_ID / APP_SECRET
npm install
npm start
```

打开 <http://localhost:3010/demo/>。控制台**按场景组织**，和下面「集成说明」一一对应：

- 顶部一条**共享上下文**：demo 后端地址、`account` / `userName`、签名有效期、`reportId`、查询参数。
  这些值被所有场景共用，也都会被写进签名。
- 中间一排**场景页签**，一次只看一个：嵌入查看 → 接收事件 → 宿主调用 → 报表发现 → 服务端导出 → 外部数据集。
  每个场景里是：一句话目标 + 该场景专属字段 + 主操作按钮 + **用当前表单值生成的可复制代码** + 结果。
- 右侧常驻**报表预览**与**观察窗**（事件日志 / 调用结果 / embed URL / 发现结果 / 请求日志）。
  用横向页签而不是侧边栏，是为了把宽度尽量留给报表预览——小屏笔记本上也够用。

第一次用的顺序：顶部点「读取配置并检测」→ 场景 4 选一张报表 → 场景 1 打开（`⌘/Ctrl + ↵`）。
场景地址带 hash（如 `#/events`），可以直接把某个场景的链接发给同事。

Windows 用户可以直接双击 `start-demo.cmd`；macOS / Linux 用 `./start-demo.sh`。
也支持 Docker：`cd backend-node && docker compose up --build`。

## 目录结构

```
backend-node/                 后端样例（Express，唯一持有 appSecret 的地方）
  src/signature-service.js    ★ 签名算法，40 行，可直接照搬到你的后端
  src/report-url-service.js   ★ 拼签名 URL
  src/staged-dataset-service.js 外部数据集上传 / 清除
  src/index.js                demo 用的 HTTP 接口 + 静态托管
  requests.http               VS Code REST Client 可直接跑的请求集
frontend-static/              前端控制台（原生 HTML/CSS/JS，无构建）
  sight-report-embed.js       ★ 宿主 SDK，零依赖 UMD，可直接拷进你的项目
  sight-report-embed.d.ts     SDK 类型声明
  index.html / app.js / styles.css
docs/integration-checklist.md 交付 / 联调检查清单
docs/screenshots/             截图目录
```

打星的三个文件是**真正要搬进你项目的东西**，其余都是为了让 demo 能跑起来。

## 集成说明

### 签名规则（公共）

所有嵌入与 `/api/embed/*` 调用共用一套签名，签名结果放在查询参数 `_s` 里。

| 项 | 规则 |
| --- | --- |
| 签名内容 | `appId \| account \| userName \| reportId \| expireAt`（竖线连接） |
| 算法 | `HMAC-SHA256(签名内容, appSecret)`，输出小写十六进制 |
| 参数体 | 上述字段加 `signature` 组成 JSON，再做 **Base64Url**（无填充）编码 |
| 放置位置 | 查询参数 `_s` |
| `expireAt` | Unix 秒。查看类建议 5~15 分钟；每次打开实时生成，**不要缓存 URL** |
| `reportId` | 查看报表建议绑定具体值；获取列表通常留空；服务端导出**必须**与 `fileId` 一致 |

`account` / `userName` 是第三方系统的当前登录人。外部用户会自动映射为报表系统内部用户，
账号形如 `ext__{appId}__{account}`。

**Node.js**（完整实现见 `backend-node/src/signature-service.js`）

```js
const crypto = require('crypto')

function buildSignatureToken({ appId, appSecret, account, userName, reportId, expireAt }) {
  const signContent = [appId, account, userName, reportId || '', String(expireAt)].join('|')
  const signature = crypto.createHmac('sha256', appSecret).update(signContent, 'utf8').digest('hex')
  const payload = JSON.stringify({ appId, account, userName, reportId, expireAt, signature })
  return Buffer.from(payload, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}
```

**Java**

```java
long expireAt = System.currentTimeMillis() / 1000 + expireMinutes * 60L;
String signContent = String.join("|", appId, account, userName,
        reportId == null ? "" : reportId, String.valueOf(expireAt));

Mac mac = Mac.getInstance("HmacSHA256");
mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
StringBuilder hex = new StringBuilder();
for (byte b : mac.doFinal(signContent.getBytes(StandardCharsets.UTF_8))) {
    hex.append(String.format("%02x", b));
}

String payload = String.format(
        "{\"appId\":\"%s\",\"account\":\"%s\",\"userName\":\"%s\","
      + "\"reportId\":\"%s\",\"expireAt\":%d,\"signature\":\"%s\"}",
        appId, account, userName, reportId, expireAt, hex);

String s = Base64.getUrlEncoder().withoutPadding()
        .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
String embedUrl = baseUrl + "/embed.html?reportId=" + reportId + "&_s=" + s;
```

**Python**

```python
import base64, hashlib, hmac, json, time

def build_signature(app_id, app_secret, account, user_name, report_id="", expire_minutes=10):
    expire_at = int(time.time()) + expire_minutes * 60
    sign_content = "|".join([app_id, account, user_name, report_id, str(expire_at)])
    signature = hmac.new(app_secret.encode(), sign_content.encode(), hashlib.sha256).hexdigest()
    payload = json.dumps({
        "appId": app_id, "account": account, "userName": user_name,
        "reportId": report_id, "expireAt": expire_at, "signature": signature,
    }, ensure_ascii=False)
    return base64.urlsafe_b64encode(payload.encode()).rstrip(b"=").decode()
```

> **`appSecret` 只能待在服务端。** 一旦下发到浏览器，任何人都能伪造任意用户身份的报表访问。

### 两种认证方式

拿到签名后有两种用法，按调用场景选一种即可（`/api/embed/**` 不走平台登录态，只认下面两者之一）：

| 方式 | 怎么带 | 适用 |
| --- | --- | --- |
| **A. 一次性签名**（无状态，本 demo 用的就是它） | 每次请求带查询参数 `_s` | 嵌入 URL、报表发现、服务端导出。服务端不保存状态，签名到期即失效 |
| **B. 换取会话** | `POST /api/embed/auth` 用签名换 `sessionToken`，之后请求带 Header `X-Embed-Session` | 服务端要连续调多个接口时省去每次重算签名；嵌入页面内部用的就是这条 |

```http
POST /api/embed/auth
{ "signature": "<_s 的值>", "reportId": "rpt_sales" }

→ { "code": 0, "data": { "sessionToken": "...", "userId": "...", "userName": "张三",
      "externalAccount": "ext__erp-system__u1001", "appId": "erp-system",
      "reportId": "rpt_sales", "expireAt": 1735660800000 } }
```

- 会话有效期取「签名有效期」与「应用上限」（默认 60 / 最长 1440 分钟）的较小值；
  `GET /api/embed/session/validate` 校验、`POST /api/embed/session/logout` 主动失效。
- 会话模式下报表访问范围仍受限：签名绑定了 `reportId` 就只能访问该报表，未绑定则按应用白名单放行。
- **嵌入报表时你不需要自己换会话**——把带 `_s` 的 URL 交给 iframe 即可，页面内部会自己完成。

### 场景一：嵌入查看报表

```
GET {baseUrl}/embed.html?reportId={reportId}&_s={signature}
```

| 查询参数 | 说明 |
| --- | --- |
| `reportId` | 报表 ID，必填 |
| `_s` | 签名参数 |
| `parameters` | 报表查询参数，JSON 序列化后再 URL 编码，如 `{"year":2024,"month":1}` |
| `hideToolbar` | `true` 隐藏工具栏（打印 / 导出 / 分页） |
| `showQueryForm` | `false` 隐藏查询表单 |
| `viewMode` | `pagination`（分页，默认）/ `all`（全部数据） |

```js
// 宿主前端：URL 由自己的后端返回，前端不参与签名
const embedUrl = await fetch('/my-backend/report-embed-url?reportId=rpt_sales').then((r) => r.text())
document.getElementById('reportFrame').src = embedUrl
// 或 window.open(embedUrl, '_blank')
```

### 场景二：接收报表事件

报表通过 `postMessage` 向宿主发事件，信封统一为：

```ts
{ protocol: 'sight-report', name: string, payload: object,
  source: { reportId: string, cellName?: string, cid?: string }, timestamp: number }
```

事件分两级：

| 级别 | 事件 | payload |
| --- | --- | --- |
| 零配置直发 | `report:loaded` | `{ elapsedMs }`，首次渲染完成，仅一次 |
| 零配置直发 | `report:error` | `{ phase: 'load'\|'query'\|'export', message }` |
| 零配置直发 | 自定义单元格事件 | 设计器「发送事件」链接配置的参数，按点击行求值 |
| 订阅后发 | `report:query` | `{ parameters }`，用户点查询 |
| 订阅后发 | `report:query-done` | `{ parameters, elapsedMs }`，每次查询渲染完成（含首次） |
| 订阅后发 | `report:export` | `{ format }` |
| 订阅后发 | `report:print` | `{ command }` |
| 订阅后发 | `report:resize` | 报表尺寸变化（宿主按需调整 iframe 高度） |

**第一步：零配置监听**

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://报表系统地址') return      // 校验来源
  if (event.data?.protocol !== 'sight-report') return      // 校验协议命名空间
  const { name, payload, source } = event.data
  switch (name) {
    case 'report:loaded':
      console.log('报表就绪', payload.elapsedMs, 'ms')
      break
    case 'report:error':
      console.error('报表出错', payload.phase, payload.message)
      break
    case 'order-selected':      // 设计器里自定义的单元格事件名
      openOrderDetail(payload.orderId)   // source.cid 可区分展开后第几行
      break
  }
})
```

**第二步（可选）：订阅过程性事件**

```js
frame.contentWindow.postMessage(
  { protocol: 'sight-report', type: 'subscribe', events: ['report:query', 'report:export'] }, // 或 ['*']
  'https://报表系统地址'
)
```

订阅同时会让报表侧锁定宿主 origin 作为后续 `postMessage` 的 `targetOrigin`，安全性更高。

**单元格事件怎么配**：报表设计器 → 选中单元格 → 链接 → 添加链接 → **发送事件**；
事件名自定义（不能以 `report:` 开头，该前缀保留给系统事件），参数支持表达式
（如 `A2` 取当前行单元格值）。

### 场景三：宿主调用报表方法（SDK）

反方向调用走同一条 `postMessage` 通道：请求
`{ protocol:'sight-report', type:'invoke', id, method, args }`，响应
`{ ..., type:'invoke-result', id, ok, data|error }`。

直接用 `frontend-static/sight-report-embed.js`（零依赖 UMD，附 `.d.ts`）就不用关心协议细节：

```js
const report = SightReportEmbed.mount('#reportBox', {
  getEmbedUrl: () => fetch('/my-backend/embed-url').then((r) => r.text())
})

await report.ready()                          // loaded 事件 + getState 轮询兜底
report.on('report:query-done', (e) => console.log(e.payload.elapsedMs))
await report.setParameters({ year: 2025 })    // 合并参数并重新出数（等完成）
const state = await report.getState()         // 参数 / 变量 / 页码 / 加载状态
const cell = await report.getCellValue('C4')  // 单元格渲染后显示值（grid 报表）
await report.export('excel')                  // 受理即回，完成看 report:export 事件
await report.reload()                         // 重新取签名 URL 并重载
```

已有 iframe 元素时用 `SightReportEmbed.connect(iframeEl)`。

| 方法 | 说明 |
| --- | --- |
| `setParameters(params, { query })` | 合并参数；`query !== false` 时立即出数并等完成 |
| `query()` / `reset()` | 重新查询 / 重置参数 |
| `export(format)` / `print(command)` | 受理即回，完成看对应事件 |
| `getState()` | 参数、变量、当前页 / 总页数、加载状态、当前 sheet |
| `setSheet(sheetId)` | 多 sheet（页签）报表切换 |
| `getCellValue(name)` / `getCellValues(name)` | 单元格渲染后显示值（首个 / 全部） |
| `invoke(method, ...args)` | 泛化调用，协议加方法时旧 SDK 不用升级 |

写类方法在报表首次加载完成前返回 `not-ready`；过程性事件由 SDK 自动订阅。
如果宿主是 Vue 应用且能引入报表组件，也可以用组件方式
`<ReportView ref="reportRef" :file-id="reportId" @report-event="onReportEvent" />`——
组件通道不需要订阅，事件全量触发，方法经 `ref` 直接调。

### 场景四：获取报表列表

先让用户选报表，再打开：

```
GET {baseUrl}/api/embed/report/type-tree?_s={signature}&fileType=grid
GET {baseUrl}/api/embed/report/tag-list?_s={signature}&tag=monthly
```

- `fileType`：`grid` / `document` / `datawall` / `mobile`
- 签名里的 `reportId` 通常**留空**，返回应用白名单范围内的全部结果
- 配了「报表白名单」后这两个接口自动受限，第三方不用再过滤一遍

### 场景五：服务端直接导出

服务端拿文件流，用于下载、归档、邮件、定时任务：

```
GET {baseUrl}/api/embed/export/{pdf|excel|word|csv|ofd}?fileId={reportId}&_s={signature}
```

| 查询参数 | 说明 |
| --- | --- |
| `fileId` | 报表 ID，**必须与签名里的 `reportId` 完全一致** |
| `parameters` | 报表查询参数（JSON 文本） |
| `fileName` | 可选，导出文件名 |
| `pageIndex` | 可选，导出指定页 |
| `sheetId` | 可选，多页签报表指定页签 |

有效期建议 5~15 分钟。签名 `reportId` 留空会被服务端拒绝。

数据量大的 Excel 走异步任务：`POST /api/embed/export/excel` 建任务 →
`GET /api/embed/export/excel/task/{taskId}` 查进度 →
`GET /api/embed/export/excel/download/{taskId}` 下载。

> `/api/embed/**` 有速率限制：同一 IP 每分钟最多 120 次请求，超出返回 429。批量导出时注意节流。

### 场景六：外部数据集

报表里用了「外部数据集」时，数据由第三方系统推过来，而不是报表去连库：

1. **上传** — `POST /api/embed/staged-dataset/set`，body 带 `signature` / `reportId` / `datasets`，返回 `token`
2. **使用** — 生成 embed URL 或调导出时，`parameters` 里加 `"_dataIds": "<token>"`
3. **清除（可选）** — `POST /api/embed/staged-dataset/clear`，body 带 `signature` / `token`

```json
POST /api/embed/staged-dataset/set
{
  "signature": "<签名 token>",
  "reportId": "rpt_sales",
  "datasets": {
    "orders": [
      { "orderId": "ORD-001", "product": "Widget A", "quantity": 10, "price": 99.5 },
      { "orderId": "ORD-002", "product": "Widget B", "quantity": 5, "price": 149 }
    ]
  }
}

→ { "code": 0, "data": { "token": "a1b2c3d4", "datasetNames": ["orders"] } }
```

- 一次请求可传多个数据集，共享一个 token；每次 `/set` 生成新 token，**不支持追加**
- 数据默认保留 **24 小时**，payload 上限 **5 MB**
- 报表设计时需先创建「外部数据集」并定义字段结构

## Demo 后端接口一览

这些是**样例后端自己的**接口（前端控制台在调），不是报表系统的对外契约。
真实项目里换成你自己的接口命名即可。

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/health` | 存活检查 |
| GET | `/api/demo/config` | 返回非敏感配置 + 报表系统可达性探测 |
| POST | `/api/demo/embed-url` | 生成签名嵌入 URL |
| GET | `/api/demo/report/type-tree` | 代理目录树 |
| GET | `/api/demo/report/tag-list` | 代理标签列表 |
| GET | `/api/demo/export/:format` | 代理导出（pdf / excel / word / csv） |
| POST | `/api/demo/staged-dataset/set` | 上传外部数据集 |
| POST | `/api/demo/staged-dataset/clear` | 按 token 清除 |
| POST | `/api/demo/staged-dataset/embed-url` | 生成带 `_dataIds` 的嵌入 URL |
| GET | `/demo/` | 托管前端控制台 |

字段级说明见 [`backend-node/README.md`](./backend-node/README.md)，
可直接运行的请求样例见 [`backend-node/requests.http`](./backend-node/requests.http)。

## 上生产前的检查清单

- [ ] `appSecret` 只在服务端出现，没有进任何前端包、日志或前端可读的接口响应
- [ ] embed URL 每次打开实时生成，有效期 5~15 分钟，没有落库或落缓存
- [ ] 宿主监听 `message` 时同时校验 `event.origin` 和 `data.protocol`
- [ ] 报表系统里配置了「报表白名单」，限定该应用能访问的报表范围
- [ ] `account` 用的是第三方系统真实登录人，不是写死的共享账号
- [ ] 服务端导出的签名 `reportId` 与 `fileId` 一致，且没留空
- [ ] 这个 demo 后端本身不上生产——把签名逻辑搬进你自己的后端

完整联调清单见 [`docs/integration-checklist.md`](./docs/integration-checklist.md)。

## 排查常见问题

| 现象 | 先查什么 |
| --- | --- |
| 控制台顶栏显示「连不上」 | demo 后端没起，或前端填的后端地址不对 |
| 显示「后端在，报表系统不通」 | `SIGHT_REPORT_BASE_URL` 错、端口不通、或跨网段被拦 |
| 打开报表 401/403 | `appId`/`appSecret` 不匹配、签名过期、`reportId` 不在白名单 |
| 页面打开但报表空白 | `reportId` 不存在；或报表本身取数为空；看「事件日志」里的 `report:error` |
| 列表接口返回空 | `tag` 需精确匹配、`fileType` 与报表类型不符、白名单挡住了 |
| 导出失败 | 签名 `reportId` 与 `fileId` 不一致，或 `parameters` 不是合法 JSON |
| 收不到 `report:query` 等事件 | 过程性事件必须先 `subscribe`；`report:loaded` 是零配置的 |
| 收不到任何事件 | `event.origin` 校验写错了报表系统地址 |

## 许可

MIT License，见 [LICENSE](./LICENSE)。示例代码可自由复制到你自己的项目中。
