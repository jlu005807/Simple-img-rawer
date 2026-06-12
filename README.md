# Simple Img Rawer

一个纯静态的多节点图片生成页面。项目不依赖后端服务，直接在浏览器里保存 API 节点、填写提示词、上传参考图，并按节点顺序尝试生成图片。

## 功能

- 多 API 节点配置：支持启用、禁用、排序、重试和超时设置。
- 多协议尝试：支持 OpenAI 兼容接口、异步接口、Chat Completions 风格接口和自定义接口。
- 三列工作区：左侧节点设置，中间提示词和参数，右侧结果预览。
- 参考图上传：本地转为 `data:image` 后随请求发送。
- 深色模式：自动跟随系统偏好，也可以手动切换。
- 结果自动清理：过期链接会在渲染时从本地状态移除。
- 预览和下载优先使用内联数据：如果接口同一结果同时返回远程 URL 和 `b64_json`，页面保留远程 URL 便于复制，但预览和下载优先使用 `data:image`，避免远程图片 403 或跨域下载失败。
- giscus 评论区：页面底部可以围绕生成结果讨论，适合分享提示词、参数和生成的图片。

## 评论区

页面底部集成了 giscus 评论系统，当前配置绑定到 `jlu005807/Simple-img-rawer` 仓库的 `Announcements` 分类。生成图片后，欢迎把提示词、参数、生成图链接或截图分享到下方评论区，方便复现和交流。

如果你克隆或 fork 这个仓库，需要二选一处理 giscus：

1. 继续使用评论区：在自己的 GitHub 仓库开启 Discussions，到 giscus 配置页生成新的 `data-repo`、`data-repo-id`、`data-category` 和 `data-category-id`，然后替换 `index.html` 里的 giscus 脚本属性。
2. 弃用评论区：删除 `index.html` 里的 `.giscus-comments` 区块；如果想彻底清理，也可以移除 `static-image-app.js` 中的 `syncGiscusTheme` 和 `postGiscusTheme`。

评论区主题会跟随页面深色/亮色模式切换。

## 使用方式

直接用浏览器打开 `index.html` 即可，不需要安装依赖或启动服务。

1. 在“节点设置”里填写节点名称、Base URL、API Key、模型和协议。
2. 保存并启用至少一个节点。
3. 在中间列填写提示词、尺寸、质量和生成数量。
4. 可选上传参考图。
5. 点击生成，右侧会显示结果预览、统一结果链接和下载按钮。

## 节点说明

Base URL 根据协议有不同含义：

- `OpenAI` / `自动`：填写接口根地址，例如 `https://api.example.com` 或 `https://api.example.com/v1`。
- `异步`：填写异步中转根地址，例如 `https://fnuu.net`；如果直接填写文档里的 `https://fnuu.net/async/images`，页面也会自动归一化，避免重复拼接路径。
- `Chat`：提交到 `/v1/chat/completions`。
- `自定义`：直接向 Base URL 发起请求。

`自动` 协议会按当前节点特征选择候选顺序，普通节点优先尝试 OpenAI 兼容接口，已知异步中转节点优先尝试异步接口。

## 异步节点

异步协议按 `fnuu.net` 的接口文档处理：

- 提交任务：`POST /async/images`。
- 文生图请求体：JSON，包含 `model`、`prompt`、`n`，可选 `size` 和 `quality`。
- 参考图生图：使用 `multipart/form-data`，字段名为 `image`，直接上传本地文件；浏览器会自动设置 multipart 边界，代码不会手动写 `Content-Type`。
- 轮询任务：优先使用提交响应里的 `poll_url`；没有 `poll_url` 时使用 `/async/images/{task_id}`。
- 轮询间隔：4 秒，符合文档建议的 3-5 秒。
- 节点超时建议：`gpt-image-2` 单张通常需要 1-3 分钟，建议把节点超时设为 180 秒或更高。
- 完成结果：`status` 为 `completed` 时，从 `urls` 数组读取临时图片直链；`failed` 时显示接口返回的错误原因。

## GitHub Pages 与 CORS

项目可以部署到 GitHub Pages，例如 `https://jlu005807.github.io/Simple-img-rawer/`。但 GitHub Pages 只是静态托管 HTML、CSS 和 JavaScript，不会把 API 请求转发成同源请求，也不能替第三方接口补 CORS 头。

在 Pages 上调用异步中转时，浏览器实际会从来源 `https://jlu005807.github.io` 请求 `https://fnuu.net`。因为请求带有 `Authorization`，并且文生图使用 `Content-Type: application/json`，浏览器会先发送 `OPTIONS` 预检。异步中转服务端需要支持：

```http
Access-Control-Allow-Origin: https://jlu005807.github.io
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Accept
```

如果生成一点击就失败，通常按下面顺序排查：

1. 打开浏览器 DevTools 的 Network，查看是否有 `OPTIONS /async/images`。
2. 如果 `OPTIONS` 是 `405`、没有 `Access-Control-Allow-Origin`，或 Console 出现 CORS preflight 错误，这是中转服务端未开放浏览器跨域；静态页面无法绕过，需要中转服务端修 CORS，或自己部署一个后端代理。
3. 如果 `POST /async/images` 成功返回 `task_id`，但后续 `GET /async/images/{task_id}` 失败，再看轮询响应里的 `status` 和 `error`。
4. 如果接口返回 `failed`，这是上游任务失败、Key/余额/参数问题或模型失败，不是 GitHub Pages 本身的问题。

## 预览与下载策略

浏览器对跨域图片下载有限制：

- 远程图片能显示，不代表前端能读取它。
- 如果源站没有开启 CORS，`fetch(url)` 不能拿到图片 blob。
- 对跨域 URL 使用 `<a download>` 时，浏览器也可能忽略下载并打开原图。

因此项目采用以下顺序：

1. 如果结果本身是 `data:image`，直接预览和下载。
2. 如果同一响应项同时有 `url` 和 `b64_json`，链接栏保留 `url`，预览和下载使用由 `b64_json` 生成的 `data:image`。
3. 如果只有远程 URL，先尝试 `fetch -> blob -> download`。
4. 如果远程 URL 受跨域限制，则触发浏览器直接下载兜底；源站不允许时，静态页面无法强制保存。

为了避免 localStorage 过大，内联 `data:image` 只保留在当前页面状态里，不会写入持久化结果链接。

## 项目结构

```text
.
|-- index.html
|-- assets/
|   |-- css/
|   |   `-- styles.css
|   `-- js/
|       |-- static-image-app.js
|       `-- static-image-core.js
`-- tests/
    |-- static-image-core.test.js
    `-- static-page-smoke.test.js
```

## 验证

项目使用 Node.js 内置测试运行器：

```bash
node --test tests/static-image-core.test.js tests/static-page-smoke.test.js
node --check assets/js/static-image-core.js
node --check assets/js/static-image-app.js
```
