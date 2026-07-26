# Simple Img Rawer

一个纯静态的多节点图片生成页面。项目不依赖后端服务，直接在浏览器里保存 API 节点、填写提示词、上传参考图，并按节点顺序尝试生成图片。

对于想尝试更多功能的生图爱好者可以尝试使用[img-Creater](https://github.com/jlu005807/img-Creater)进行本地化生图平台部署，尝试局部编辑和修正，以及历史会话和图片的持久化保存

## 功能

- 多 API 节点配置：支持启用、禁用、排序、重试和超时设置。
- 多协议尝试：支持 OpenAI 兼容接口、异步接口、Chat Completions 风格接口和自定义接口。
- 三列工作区：左侧节点设置，中间提示词和参数，右侧结果预览。
- 参考图上传：支持文件选择、拖拽到虚线区域、以及直接 Ctrl+V 粘贴截图；本地转为 `data:image` 后随请求发送，支持逐张移除。
- 快捷键：Ctrl+Enter（或 Cmd+Enter）直接触发生成。
- 深色模式：自动跟随系统偏好，也可以手动切换；页面加载时用内联脚本提前应用主题，避免深色用户看到白屏闪烁。
- 结果自动清理：过期链接会在渲染时从本地状态移除。
- 预览和下载优先使用内联数据：如果接口同一结果同时返回远程 URL 和 `b64_json`，页面保留远程 URL 便于复制，但预览和下载优先使用 `data:image`，避免远程图片 403 或跨域下载失败。
- giscus 评论区：页面底部可以围绕生成结果讨论，适合分享提示词、参数和生成的图片。

## 评论区

页面底部集成了 giscus 评论系统，当前配置绑定到 `jlu005807/Simple-img-rawer` 仓库的 `Announcements` 分类。生成图片后，欢迎把提示词、参数、生成图链接或截图分享到下方评论区，方便复现和交流。

如果你克隆或 fork 这个仓库，需要二选一处理 giscus：

1. 继续使用评论区：在自己的 GitHub 仓库开启 Discussions，到 giscus 配置页生成新的 `data-repo`、`data-repo-id`、`data-category` 和 `data-category-id`，然后替换 `static-image-app.js` 中 `mountGiscus` 函数里的对应属性（giscus 脚本由该函数动态注入，保证首屏就是当前主题）。
2. 弃用评论区：删除 `index.html` 里的 `.giscus-comments` 区块；如果想彻底清理，也可以移除 `static-image-app.js` 中的 `mountGiscus`、`syncGiscusTheme` 和 `postGiscusTheme`。

评论区主题会跟随页面深色/亮色模式切换。

## 安全与信任边界

- API Key 明文保存在浏览器 localStorage（页面上有相同提示），只随生成请求发给你自己填写的节点。
- giscus 的 `client.js` 以完整页面权限运行在本页面上，这是对 giscus.app 的信任假设；不想承担的话按上文说明删除评论区区块即可。
- 部署到 GitHub Pages 时注意：同一账号的所有项目 Pages 共享 `https://<用户名>.github.io` 这一个源（origin），该源下任何页面的脚本都能读取本页面存的 localStorage（包括 API Key）。介意的话建议使用自定义域名，或直接本地打开 `index.html` 使用。
- 多标签页同时使用时，节点与结果的保存是整体覆盖写入，后保存的标签页会覆盖先保存的改动。
- 异步响应里的 `poll_url` 只有与节点同主机时才会使用，跨主机的绝对地址会被忽略并回退到默认轮询路径，避免 `Authorization` 头被发往其他域名。

## 使用方式

直接用浏览器打开 `index.html` 即可，不需要安装依赖或启动服务。

1. 在“节点设置”里填写节点名称、Base URL、API Key、模型和协议。
2. 保存并启用至少一个节点。
3. 在中间列填写提示词、尺寸、质量和生成数量。
4. 可选上传参考图：点击选择、拖进虚线框，或直接粘贴剪贴板里的截图。
5. 点击生成（或按 Ctrl+Enter），右侧会显示结果预览、统一结果链接和下载按钮；点击预览图可在新标签页查看原图。

## 节点说明

Base URL 根据协议有不同含义：

- `OpenAI` / `自动`：填写接口根地址，例如 `https://api.example.com` 或 `https://api.example.com/v1`。
- `异步`：填写异步中转根地址，例如 `https://fnuu.net`；如果直接填写文档里的 `https://fnuu.net/async/images`，页面也会自动归一化，避免重复拼接路径。
- `Chat`：提交到 `/v1/chat/completions`。
- `自定义`：直接向 Base URL 发起请求。

`自动` 协议会按当前节点特征选择候选顺序，普通节点优先尝试 OpenAI 兼容接口，已知异步中转节点优先尝试异步接口。

节点超时覆盖从发起请求到响应体读取完成的完整过程，停止按钮同样可以在读取响应体阶段生效。

## 异步节点

异步协议按 `fnuu.net` 的接口文档处理：

- 提交任务：`POST /async/images`。
- 文生图请求体：JSON，包含 `model`、`prompt`、`n`，可选 `size` 和 `quality`。
- 参考图生图：使用 `multipart/form-data`，字段名为 `image`，直接上传本地文件；浏览器会自动设置 multipart 边界，代码不会手动写 `Content-Type`。
- 轮询任务：优先使用提交响应里的 `poll_url`；没有 `poll_url` 时使用 `/async/images/{task_id}`。
- 轮询间隔：4 秒，符合文档建议的 3-5 秒；单次任务轮询总时长上限 10 分钟，超时会停止并报错，避免卡死在停不下来的任务上。
- 轮询容错：网络错误、单次超时、5xx/429 或非 JSON 响应会容忍连续 3 次以内的失败并继续轮询（仍受 10 分钟总预算约束）；4xx（除 429）说明任务查询本身被拒绝，会立即失败并显示接口返回的错误。
- 轮询地址：优先使用与节点同主机的 `poll_url`；跨主机的绝对 `poll_url` 会被忽略，回退到 `/async/images/{task_id}`。
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
- 远程图片直链也可能直接返回 `403 Forbidden`，这时不能作为 `<img src>` 预览源。
- 如果源站没有开启 CORS，`fetch(url)` 不能拿到图片 blob。
- 对跨域 URL 使用 `<a download>` 时，浏览器也可能忽略下载并打开原图。

因此项目采用以下顺序：

1. 如果结果本身是 `data:image`，直接预览和下载。
2. 如果同一响应项同时有 `url` 和 `b64_json`，链接栏保留 `url`，预览和下载使用由 `b64_json` 生成的 `data:image`。
3. 如果只有远程 URL，先尝试 `fetch -> blob -> download`。
4. 如果远程 URL 受跨域限制，则触发浏览器直接下载兜底；源站不允许时，静态页面无法强制保存。

为了避免远程图床 403 导致刷新后无法预览，页面会把 `data:image` 一起写入本地结果记录。浏览器 localStorage 容量有限，写入超出配额时页面会逐个剔除体积最大的记录（通常是内联 b64 大图）来保住其余记录，并在状态栏如实提示保留条数。内联 `data:image` 结果不会像远程直链那样按过期时间清理，会一直保留到被配额裁剪或手动点"清理链接"。

内联 `data:image` 图片点击预览放大或"原图"按钮时，页面会先把它转换成 Blob URL 再在新标签页打开——浏览器出于安全原因禁止直接把标签页导航到 `data:` 地址。

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
npm test
npm run check
```

也可以直接运行底层命令：

```bash
node --test tests/static-image-core.test.js tests/static-page-smoke.test.js
node --check assets/js/static-image-core.js
node --check assets/js/static-image-app.js
```
