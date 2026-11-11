# Screenshots

README 里引用的截图。**控制台、签名链路、事件与 invoke 协议都是真实运行的**；报表内容是演示用
示例数据（销售/区域这类通用假数据），由一个本地 mock 报表服务渲染，不含任何真实业务数据、
客户名称或内网地址。

| 文件 | 内容 |
| --- | --- |
| `console.png` | 场景 1：共享上下文 + 嵌入查看 + 报表预览 + embed URL |
| `events.png` | 场景 2：单元格「发送事件」→ 宿主收到自定义事件与 payload |
| `invoke.png` | 场景 3：SDK `getState` / `getCellValue` 的返回值 |
| `discover.png` | 场景 4：目录树结果扁平成可点列表 + 原始 JSON |
| `staged.png` | 场景 6：上传外部数据集拿到 token |
| `embedded-report.png` | 嵌入的报表本体（新窗口效果） |

## 想自己重拍

1. 起 demo 后端，`SIGHT_REPORT_BASE_URL` 指向你自己的 Sight Report 部署
2. 浏览器窗口调到 1440×900 左右，缩放 100%，逐个场景走一遍
3. 只截页面视口（不要带浏览器地址栏、书签栏、扩展提示条），导出宽度 ≥ 1600px
4. 替换本目录同名文件即可，README 不用改

拍摄时请检查画面里没有真实客户名称、内网 IP、真实账号与密钥。
