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
