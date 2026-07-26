const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

test('static entry exposes node setup, generation, and result surfaces', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

  assert.match(html, /assets\/js\/static-image-core\.js\?v=20260717-studio/)
  assert.match(html, /assets\/js\/static-image-app\.js\?v=20260717-studio/)
  assert.match(html, /assets\/css\/styles\.css/)
  assert.match(html, /id="node-form"/)
  assert.match(html, /id="generation-form"/)
  assert.match(html, /id="result-grid"/)
  assert.match(html, /class="github-link"/)
  assert.match(html, /href="https:\/\/github\.com\/jlu005807\/Simple-img-rawer"/)
  assert.match(html, /aria-label="打开 GitHub 仓库"/)
  assert.doesNotMatch(html, /\/api\/generate/)
  assert.equal(pkg.scripts.test, 'node --test tests/static-image-core.test.js tests/static-page-smoke.test.js')
  assert.equal(pkg.scripts.check, 'node --check assets/js/static-image-core.js && node --check assets/js/static-image-app.js')
})

test('layout uses three columns with result display on the right', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  const css = fs.readFileSync(path.join(root, 'assets', 'css', 'styles.css'), 'utf8')

  assert.match(html, /class="workspace three-column"/)
  assert.match(html, /class="panel node-panel compact-panel"/)
  assert.match(html, /class="panel generation-panel compact-panel"/)
  assert.match(html, /class="panel result-panel result-stage"/)
  assert.doesNotMatch(html, /class="control-rail"/)
  assert.match(css, /grid-template-columns:\s*minmax\(280px,\s*360px\)\s*minmax\(320px,\s*460px\)\s*minmax\(0,\s*1fr\)/)
  assert.match(css, /\.preview-wrap\s*\{[^}]*flex:\s*1/s)
  assert.match(css, /\.compact-panel textarea\s*\{[^}]*min-height:\s*92px/s)
})

test('entry exposes dark mode and no visible countdown copy', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  const css = fs.readFileSync(path.join(root, 'assets', 'css', 'styles.css'), 'utf8')
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')

  assert.match(html, /id="theme-toggle"/)
  assert.match(css, /\[data-theme="dark"\]/)
  assert.match(app, /theme-toggle/)
  assert.doesNotMatch(html, /倒计时|一小时/)
  assert.doesNotMatch(html, /图片不做持久化/)
  assert.doesNotMatch(app, /timeLeftLabel/)
})

test('css references only defined theme variables', () => {
  const css = fs.readFileSync(path.join(root, 'assets', 'css', 'styles.css'), 'utf8')
  const defined = new Set([...css.matchAll(/--([a-z0-9-]+)\s*:/gi)].map((match) => match[1]))
  const referenced = [...css.matchAll(/var\(--([a-z0-9-]+)\)/gi)].map((match) => match[1])
  const missing = referenced.filter((name) => !defined.has(name))

  assert.deepEqual([...new Set(missing)].sort(), [])
})

test('download fallback does not open the original image', () => {
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')

  assert.doesNotMatch(app, /catch\s*\{\s*setStatus\([^)]*\)\s*openActiveOriginal\(\)/)
  assert.match(app, /triggerDirectUrlDownload\(downloadUrl,\s*filename\)/)
})

test('download prefers inline data when the result has a separate download URL', () => {
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')

  assert.match(app, /downloadUrl\s*=\s*active\.downloadUrl\s*\|\|\s*active\.url/)
  assert.match(app, /downloadUrl\.startsWith\('data:image\/'\)/)
  assert.match(app, /triggerDownload\(downloadUrl,\s*filename\)/)
})

test('fetch errors are normalized across browser engines', () => {
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')

  assert.match(app, /function isNetworkFetchError\(error\)/)
  assert.match(app, /function describeFetchErrorReason\(error\)/)
  assert.match(app, /function formatNetworkFetchError\(error\)/)
  assert.match(app, /failed to fetch/)
  assert.match(app, /load failed/)
  assert.match(app, /networkerror/)
  assert.match(app, /network request failed/)
  assert.match(app, /error\.name/)
  assert.match(app, /error\.message/)
  assert.match(app, /浏览器原始错误/)
  assert.match(app, /isNetworkFetchError\(error\)/)
  assert.match(app, /formatNetworkFetchError\(error\)/)
  assert.match(app, new RegExp('\\u8bf7\\u6c42\\u5931\\u8d25.*CORS'))
  assert.match(app, /\$\{base\}。浏览器原始错误：\$\{reason\}/)
})

test('result previews prefer inline data when a remote URL is blocked', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')

  assert.match(html, /预览和下载优先使用内联数据/)
  assert.match(html, /static-image-app\.js\?v=20260717-studio/)
  assert.match(app, /src="\$\{escapeAttribute\(core\.resultDisplayUrl\(item\)\)\}"/)
  assert.match(app, /elements\.resultPreview\.src\s*=\s*core\.resultDisplayUrl\(active\)/)
  assert.match(app, /本地存储空间不足，仅保留/)
  assert.match(readme, /403 Forbidden/)
  assert.match(readme, /localStorage 容量有限/)
})

test('entry embeds giscus comments and syncs the comment theme', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')

  assert.match(html, /class="giscus-comments"/)
  assert.match(html, /data-repo="jlu005807\/Simple-img-rawer"/)
  assert.match(html, /data-category="Announcements"/)
  assert.match(html, /data-theme="light"/)
  assert.match(html, /晒出你的提示词/)
  assert.match(html, /参数/)
  assert.match(html, /成品图/)
  assert.match(html, /友好发言/)
  assert.match(html, /href="https:\/\/github\.com\/jlu005807\/Simple-img-rawer\/discussions\/1"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/)
  assert.match(app, /syncGiscusTheme\(theme\)/)
  assert.match(app, /querySelector\('iframe\.giscus-frame'\)/)
  assert.match(app, /postMessage\(\{\s*giscus:\s*\{\s*setConfig:\s*\{\s*theme\s*\}/s)
  assert.match(readme, /giscus/)
  assert.match(readme, /克隆|fork/i)
  assert.match(readme, /弃用|移除/)
})

test('async provider follows the documented fnuu polling and image upload contract', () => {
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')

  assert.doesNotMatch(app, /\/async\/task\//)
  assert.match(app, /core\.resolveAsyncPollUrl\(node\.base_url,\s*taskId,\s*submitObject\.poll_url\)/)
  assert.match(app, /const hasReferences = references\.length > 0/)
  assert.match(app, /body\.append\('image',\s*item\.file/)
  assert.match(app, /headers: authHeaders\(node,\s*!hasReferences\)/)
  assert.match(readme, /GitHub Pages 与 CORS/)
  assert.match(readme, /Access-Control-Allow-Origin/)
  assert.match(readme, /OPTIONS \/async\/images/)
  assert.match(readme, /https:\/\/fnuu\.net\/async\/images/)
})

test('async polling has a total time budget so stuck tasks stop', () => {
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')

  assert.match(app, /ASYNC_POLL_BUDGET_MS/)
  assert.match(app, /pollDeadline/)
  assert.match(app, /ASYNC_POLL_INTERVAL_MS/)
})

test('page head ships favicon, meta description, theme-color, and pre-paint theme script', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')

  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml/)
  assert.match(html, /<meta name="description"/)
  assert.match(html, /<meta name="theme-color"[^>]*prefers-color-scheme: light/)
  assert.match(html, /<meta name="theme-color"[^>]*prefers-color-scheme: dark/)
  assert.match(html, /preApplyTheme/)
  assert.match(html, /simple-img-static\.theme\.v1/)
  assert.match(html, /<noscript>/)
})

test('references support individual removal and read failures are surfaced', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')
  const css = fs.readFileSync(path.join(root, 'assets', 'css', 'styles.css'), 'utf8')

  assert.match(app, /data-reference-id/)
  assert.match(app, /onReferenceRemove/)
  assert.match(app, /读取参考图失败/)
  assert.match(css, /\.reference-remove/)
  assert.match(html, /id="reference-list"/)
})

test('node action buttons and key toggle expose accessible names', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')

  assert.match(html, /id="reveal-key"[^>]*aria-label="显示或隐藏 API Key"/)
  assert.match(app, /aria-label="上移节点/)
  assert.match(app, /aria-label="删除节点/)
  assert.match(html, /id="attempt-list"[^>]*aria-live="polite"/)
})

test('stopped attempts get a distinct dot color and storage guards against corruption', () => {
  const css = fs.readFileSync(path.join(root, 'assets', 'css', 'styles.css'), 'utf8')
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')

  assert.match(css, /\.attempt-stopped \.attempt-dot/)
  assert.match(app, /function loadJsonArray\(key\)/)
  assert.match(app, /Array\.isArray\(value\) \? value : \[\]/)
})

test('references accept drag-and-drop and clipboard paste', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')
  const css = fs.readFileSync(path.join(root, 'assets', 'css', 'styles.css'), 'utf8')

  assert.match(html, /id="reference-dropzone"/)
  assert.match(html, /拖拽图片到此处/)
  assert.match(app, /function bindDropzoneEvents\(\)/)
  assert.match(app, /addEventListener\('drop'/)
  assert.match(app, /function onGlobalPaste\(event\)/)
  assert.match(app, /addReferenceFiles/)
  assert.match(css, /\.reference-dropzone\.drag-over/)
})

test('generation exposes a keyboard shortcut and locks references while running', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')

  assert.match(html, /Ctrl \+ Enter 快速生成/)
  assert.match(app, /function onGlobalKeydown\(event\)/)
  assert.match(app, /requestSubmit\(\)/)
  assert.match(app, /生成过程中不能修改参考图/)
  assert.match(app, /elements\.referenceInput\.disabled = value/)
})

test('preview supports click-to-open and the studio look ships display fonts', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')
  const css = fs.readFileSync(path.join(root, 'assets', 'css', 'styles.css'), 'utf8')

  assert.match(html, /id="result-preview"[^>]*tabindex="0"/)
  assert.match(app, /function openPreviewZoom\(\)/)
  assert.match(css, /--font-display:/)
  assert.match(css, /\.brand-mark/)
  assert.match(css, /\.panel-index/)
  assert.match(css, /prefers-reduced-motion/)
})
