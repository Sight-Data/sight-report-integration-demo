# Frontend Console (frontend-static)

原生 HTML / CSS / JS，无构建、无依赖。它扮演「第三方宿主页面」，演示完整集成路径：
向自己的后端要签名 URL → iframe 打开报表 → 收事件 → 调方法 → 外部数据集 → 服务端导出。

Plain HTML/CSS/JS, no build step, no dependencies. It plays the role of a third-party host page.

## 文件 / Files

| 文件 | 作用 |
| --- | --- |
| `sight-report-embed.js` | **宿主 SDK**，零依赖 UMD。封装 `postMessage` 协议（ready / 事件订阅 / invoke），可直接拷进你的项目 |
| `sight-report-embed.d.ts` | SDK 类型声明 |
| `index.html` | 控制台结构：左侧四步配置、中间预览、右侧观察窗 |
| `app.js` | 控制台逻辑：请求封装、参数编辑器、报表选择、事件处理、SDK 调用 |
| `styles.css` | 样式（CSS 变量，浅色主题） |

真正值得搬走的是 `sight-report-embed.js`；`app.js` 里带注释的片段可作为宿主接入范例。

## 运行 / Run

推荐由 `backend-node` 托管（同源，不用管 CORS）：

```text
cd ../backend-node && npm start   →   http://localhost:3010/demo/
```

也可以用任意静态服务器单独跑，此时需要在控制台第 1 步里手填 demo 后端地址：

```bash
python3 -m http.server 3020      # 然后打开 http://localhost:3020
```

## 控制台里做了什么 / What the console does

- **本地记忆**：表单值存 `localStorage`，刷新不丢；「重置表单」清空
- **连通性指示**：顶栏区分「后端连不上」与「后端在、报表系统不通」两种失败
- **报表选择**：`type-tree` / `tag-list` 返回结果会被防御式扁平化成可点列表，原始 JSON 仍在「发现结果」里
- **参数编辑器**：键值表格与 JSON 视图互转，值自动识别数字 / 布尔 / null / JSON
- **事件**：零配置接收 `report:loaded` / `report:error` / 单元格事件；可勾选订阅过程性事件
- **宿主调用**：`setParameters` / `query` / `reset` / `getState` / `getCellValue(s)` / `print` / `export`
- **快捷键**：`⌘/Ctrl + Enter` 打开报表，`Esc` 关弹窗
