# 需求说明：报表嵌入事件补充页码信息

面向：报表系统（报表页面 / 嵌入协议）。宿主侧的类型、文档、demo 已按本契约就绪，等报表侧实现。

## 1. 背景

第三方宿主集成时需要知道报表总页数，并希望在翻页、切换 sheet 时得到通知。
目前宿主只能主动调 `getState()` 拉取 `currentPage / totalPages`，没有推送：

- `report:query-done` 不带页数。
- 没有当前页、总页数、sheet 变化的事件。

宿主只能轮询，有延迟且持续发消息。希望由报表侧在状态变化时推送。

## 2. 需求总览

| # | 需求 | 事件 | 订阅 |
| --- | --- | --- | --- |
| R1 | `report:query-done` payload 增加 `totalPages` | 已有事件，扩字段 | 需订阅（不变） |
| R2 | 新增合并事件 `report:view-change`，覆盖当前页、总页数、sheet 变化 | 新事件 | 需订阅 |

适用范围：仅 `grid` / `document`。`dashboard` / `datawall` 不发 `report:view-change`，`query-done` 也不带 `totalPages`。

## 3. R1：`report:query-done` 增加 `totalPages`

```ts
payload: {
  parameters: Record<string, unknown>
  elapsedMs: number
  totalPages?: number   // 新增
}
```

- 每次查询渲染完成（含首次）发出，`totalPages` 为**本次渲染分页完成后**的总页数，不能是渲染前的旧值或 0。
- 仪表盘 / 大屏不带该字段（保持 `undefined`，不要给 0）。
- 向后兼容：字段为可选新增，旧宿主忽略即可。

## 3.1 R2：新增 `report:view-change`

```ts
payload: {
  currentPage: number                // 1 起，与页面显示一致
  totalPages: number
  activeSheetId?: string             // grid 有；document 无 sheet 概念时可省略
  changed: Array<'currentPage' | 'totalPages' | 'activeSheetId'>
}
```

**触发条件**：当前页、总页数、activeSheetId 任一变化。

**语义要求**

1. **合并为一个事件**：一次用户操作或一次渲染引起的多项变化只发一次，`changed` 列出全部变化项。例如切换 sheet 导致页数与当前页都变，只发一次，`changed` 为 `['activeSheetId','totalPages','currentPage']`。
2. **字段是变化后的完整视图状态**，宿主无需自己与上次比对；`changed` 仅用于告知本次变了什么。
3. **只在值真正变化时发**，值未变不发（避免重复刷屏）。
4. **不在加载 / 重新出数过程中发中间态**：`loading` 期间不发；渲染完成后若与上一次稳定状态有差异再发一次。
5. **首次加载不发**：首屏状态由 `report:loaded` 与 `query-done` 覆盖；`view-change` 只表示"之后的变化"。
6. 触发来源包括用户操作（翻页、跳页、工具栏切 sheet）和宿主调用（`setSheet` 等），两者一视同仁。
7. 高频翻页（如连续滚动）建议节流，间隔 ≥ 100ms，保证最后一次状态必到。

**订阅机制**：与现有过程性事件一致，宿主发 `{ protocol:'sight-report', type:'subscribe', events:['report:view-change'] }` 后才发；`['*']` 也包含。信封格式不变：

```json
{
  "protocol": "sight-report",
  "name": "report:view-change",
  "payload": { "currentPage": 3, "totalPages": 12, "activeSheetId": "Sheet1", "changed": ["currentPage"] },
  "source": { "reportId": "..." },
  "timestamp": 1731720000000
}
```

## 4. 与 `getState()` 的一致性

事件与 `getState()` 必须同源：事件发出时刻调用 `getState()`，`currentPage / totalPages / activeSheetId` 应与 payload 一致。

## 5. 验收用例

| 用例 | 期望 |
| --- | --- |
| 打开 grid 报表并订阅，等 `query-done` | payload 含 `totalPages`，等于工具栏显示的总页数 |
| 点击下一页 | 收到 1 条 `view-change`，`changed=['currentPage']` |
| 改参数查询，结果页数变化 | `query-done.totalPages` 为新值；若当前页因此被截断，另发 `view-change`（`changed` 含 `currentPage`）或在 `query-done` 之后合并说明——以实现为准，需在文档标明 |
| 切换 sheet（用户点或 `setSheet`） | 收到 1 条 `view-change`，`changed` 含 `activeSheetId`，页数变化时一并列出 |
| 翻页后值未变（如已在末页点下一页） | 不发事件 |
| 仪表盘 / 大屏 | 不发 `view-change`；`query-done` 无 `totalPages` |
| 未订阅 | 不发 `view-change` |
| 旧宿主忽略新字段 | 不报错 |

## 6. 待报表侧确认的问题

1. 改参数重新出数后当前页被截断（如原在第 8 页，新结果仅 5 页）：`query-done` 与 `view-change` 的先后与是否合并，请明确。
2. `document` 类型是否有 sheet 概念；`activeSheetId` 是否省略。
3. 连续纸单据（连续纸 / 无分页）的 `totalPages` 取值：建议不带字段，并在文档标明。
4. 上线版本号：宿主需据此判断是否可依赖该事件（旧版需回退到 `getState` 拉取）。

## 7. 宿主侧现状（本仓库已完成）

- `frontend-static/sight-report-embed.d.ts`：`QueryDonePayload`、`ViewChangePayload` 类型。
- `frontend-static/sight-report-embed.js`：`report:view-change` 加入自动订阅列表。
- demo：标题栏页码显示；订阅复选框；事件缺页码时用 `getState()` 兜底。
- `README.md` / `README.zh-CN.md`：事件表已更新。
