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

test('layout gives the image preview the primary stage', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  const css = fs.readFileSync(path.join(root, 'assets', 'css', 'styles.css'), 'utf8')

  assert.match(html, /class="workspace image-first"/)
  assert.match(html, /class="panel result-panel result-stage"/)
  assert.match(html, /class="control-rail"/)
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(320px,\s*420px\)/)
  assert.match(css, /\.preview-wrap\s*\{[^}]*flex:\s*1/s)
  assert.match(css, /\.compact-panel textarea\s*\{[^}]*min-height:\s*92px/s)
})
