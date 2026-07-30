# 集成联调检查清单 / Integration Checklist

给「报表提供方 → 接入方」的交接与自测清单。中英对照，逐条打勾即可。

## 1. 需要拿到的值 / Values to obtain

- [ ] `SIGHT_REPORT_BASE_URL` — 报表系统访问地址
- [ ] `SIGHT_REPORT_APP_ID` / `SIGHT_REPORT_APP_SECRET` — 在「系统管理 → 第三方应用」创建后获得
- [ ] 至少一个真实 `reportId`
- [ ] 一个合法的 `account` 与 `userName` 示例
- [ ] （可选）用于验证 `tag-list` 的 `tag`
- [ ] （可选）推荐的 `fileType`（`grid` / `document` / `datawall` / `mobile`）
- [ ] 该应用的「报表白名单」范围是否已配置

## 2. 环境自检 / Environment

- [ ] Node.js ≥ 18（`node -v`）
- [ ] 从接入方服务器能访问报表系统（`curl {baseUrl}/api/version`）
- [ ] `backend-node/.env` 由 `.env.example` 复制而来，且**没有**被提交进版本库
- [ ] 交付包里不包含任何真实密钥

## 3. 功能验收 / Functional verification

- [ ] 控制台第 1 步「读取配置并检测」显示连接正常
- [ ] 第 2 步能列出报表（`type-tree` 或 `tag-list` 有数据）
- [ ] 第 3 步能打开报表，右侧事件日志出现 `report:loaded`
- [ ] 查询参数生效（改 `parameters` 后数据随之变化）
- [ ] `hideToolbar` / `showQueryForm` / `viewMode` 三个显示开关行为符合预期
- [ ] 点击「订阅所选」后，在报表里查询/导出能看到 `report:query` / `report:export`
- [ ] （可选）配了「发送事件」链接的单元格，点击后能收到自定义事件与 payload
- [ ] 宿主调用面板：`getState`、`setParameters`、`getCellValue` 均返回预期结果
- [ ] 服务端导出：PDF / Excel 至少各成功一次，文件能正常打开
- [ ] （可选）外部数据集：上传拿到 token → 带 token 预览 → 清除

## 4. 安全复核 / Security review

- [ ] `appSecret` 只出现在服务端进程内，未进前端包、日志、接口响应
- [ ] embed URL 每次打开实时生成，有效期 5~15 分钟，未落库未缓存
- [ ] 宿主监听 `message` 同时校验 `event.origin` 与 `data.protocol`
- [ ] `account` 取的是真实登录人，不是共享账号
- [ ] 服务端导出的签名 `reportId` 与请求参数 `fileId` 一致且非空
- [ ] 生产环境不直接跑这个 demo 后端，签名逻辑已搬进接入方自有服务

## 5. 典型问题 / Typical problems

**报表页面空白**：`SIGHT_REPORT_BASE_URL` 是否正确、`reportId` 是否存在、签名是否过期、
报表是否在白名单范围内。

**列表接口返回空**：`tag` 需精确匹配、`fileType` 与报表类型是否一致、账号是否有权访问、
白名单是否把结果全过滤掉了。

**导出失败**：`reportId` 与 `fileId` 是否一致、`parameters` 是否合法 JSON、有效期是否过短。

**收不到事件**：`report:loaded` / `report:error` / 单元格事件是零配置的，收不到基本是
`event.origin` 校验写错；`report:query` 等过程性事件必须先 `subscribe`。
