const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

test('static entry exposes node setup, generation, and result surfaces', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')

  assert.match(html, /assets\/js\/static-image-core\.js/)
  assert.match(html, /assets\/js\/static-image-app\.js/)
  assert.match(html, /assets\/css\/styles\.css/)
  assert.match(html, /id="node-form"/)
  assert.match(html, /id="generation-form"/)
  assert.match(html, /id="result-grid"/)
  assert.doesNotMatch(html, /\/api\/generate/)
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
  assert.doesNotMatch(app, /timeLeftLabel/)
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

test('entry embeds giscus comments and syncs the comment theme', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')

  assert.match(html, /class="giscus-comments"/)
  assert.match(html, /data-repo="jlu005807\/Simple-img-rawer"/)
  assert.match(html, /data-category="Announcements"/)
  assert.match(html, /data-theme="light"/)
  assert.match(html, /分享提示词和生成的图片/)
  assert.match(app, /syncGiscusTheme\(theme\)/)
  assert.match(app, /querySelector\('iframe\.giscus-frame'\)/)
  assert.match(app, /postMessage\(\{\s*giscus:\s*\{\s*setConfig:\s*\{\s*theme\s*\}/s)
  assert.match(readme, /giscus/)
  assert.match(readme, /克隆|fork/i)
  assert.match(readme, /弃用|移除/)
})

test('async provider follows the documented fnuu polling and image upload contract', () => {
  const app = fs.readFileSync(path.join(root, 'assets', 'js', 'static-image-app.js'), 'utf8')

  assert.doesNotMatch(app, /\/async\/task\//)
  assert.match(app, /core\.resolveAsyncPollUrl\(node\.base_url,\s*taskId,\s*submitObject\.poll_url\)/)
  assert.match(app, /const hasReferences = references\.length > 0/)
  assert.match(app, /body\.append\('image',\s*item\.file/)
  assert.match(app, /headers: authHeaders\(node,\s*!hasReferences\)/)
})
