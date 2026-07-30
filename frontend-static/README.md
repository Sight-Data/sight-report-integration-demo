# Frontend Console (frontend-static)

原生 HTML / CSS / JS，无构建、无依赖。它扮演「第三方宿主页面」，演示完整集成路径：
向自己的后端要签名 URL → iframe 打开报表 → 收事件 → 调方法 → 外部数据集 → 服务端导出。

Plain HTML/CSS/JS, no build step, no dependencies. It plays the role of a third-party host page.

## 文件 / Files

| 文件 | 作用 |
| --- | --- |
| `sight-report-embed.js` | **宿主 SDK**，零依赖 UMD。封装 `postMessage` 协议（ready / 事件订阅 / invoke），可直接拷进你的项目 |
| `sight-report-embed.d.ts` | SDK 类型声明 |
| `index.html` | 控制台结构：顶部共享上下文、场景页签（横向）、左侧场景面板、右侧预览 + 观察窗 |
| `app.js` | 控制台逻辑：场景路由、请求封装、参数编辑器、报表选择、事件处理、SDK 调用、代码片段生成 |
| `styles.css` | 样式（CSS 变量，浅色主题） |

真正值得搬走的是 `sight-report-embed.js`；`app.js` 里带注释的片段可作为宿主接入范例。

## 运行 / Run

推荐由 `backend-node` 托管（同源，不用管 CORS）：

```text
cd ../backend-node && npm start   →   http://localhost:3010/demo/
```

也可以用任意静态服务器单独跑，此时需要在顶部共享条里手填 demo 后端地址：

```bash
python3 -m http.server 3020      # 然后打开 http://localhost:3020
```

## 控制台里做了什么 / What the console does

按场景组织：一条共享上下文 + 六个场景页签，一次只看一个。
用横向页签而不是侧边导航，是为了把宽度留给报表预览（1180px 以下自动改成上下堆叠）。

| 场景 | 主操作 | 结果去哪看 |
| --- | --- | --- |
| 1 嵌入查看 | 打开报表 / 重新签名 | 中间预览 + 「embed URL」 |
| 2 接收事件 | 订阅所选 / 订阅全部 | 「事件日志」 |
| 3 宿主调用 | 8 个 SDK 方法 | 「调用结果」 |
| 4 报表发现 | 加载列表并点选（写回共享 reportId） | 「发现结果」 |
| 5 服务端导出 | PDF / Excel / Word / CSV | 浏览器下载 + 「请求日志」 |
| 6 外部数据集 | 上传 → 带 token 预览 → 清除 | 预览 + 「请求日志」 |

其他细节：

- **每个场景内嵌可复制代码**，用当前表单里的真实值渲染（appId、reportId、参数、origin 都是实时的）
- **场景走 hash 路由**（`#/embed`、`#/events`…），可以把某个场景的链接直接发给同事
- **本地记忆**：表单值存 `localStorage`，刷新不丢；「重置」清空
- **连通性指示**：顶栏区分「后端连不上」与「后端在、报表系统不通」；HTTP 200 但信封 `code !== 0` 也会报错
- **前置条件提示**：事件与宿主调用两个场景在没打开报表时给出提示并可一键跳转
- **参数编辑器**：键值表格与 JSON 视图互转，值自动识别数字 / 布尔 / null / JSON
- **报表选择**：`type-tree` / `tag-list` 结果防御式扁平化成可点列表，原始 JSON 始终留在「发现结果」
- **快捷键**：`⌘/Ctrl + Enter` 打开报表，`Esc` 关弹窗
