const test = require('node:test')
const assert = require('node:assert/strict')

const core = require('../assets/js/static-image-core.js')

test('builds provider endpoints without duplicating /v1', () => {
  assert.equal(core.openAiEndpoint('https://api.example.com', 'images/generations'), 'https://api.example.com/v1/images/generations')
  assert.equal(core.openAiEndpoint('https://api.example.com/v1', 'chat/completions'), 'https://api.example.com/v1/chat/completions')
  assert.equal(core.requestUrlFor({ base_url: 'https://relay.example.com/v1', api_type: 'async' }, 'async'), 'https://relay.example.com/async/images')
  assert.equal(core.requestUrlFor({ base_url: 'https://custom.example.com/path', api_type: 'custom' }, 'custom'), 'https://custom.example.com/path')
})

test('accepts documented async submit endpoints as node base URLs', () => {
  assert.equal(
    core.requestUrlFor({ base_url: 'https://fnuu.net/async/images', api_type: 'async' }, 'async'),
    'https://fnuu.net/async/images',
  )
  assert.equal(
    core.requestUrlFor({ base_url: 'https://fnuu.net/async/images/', api_type: 'async' }, 'async'),
    'https://fnuu.net/async/images',
  )
  assert.equal(
    core.resolveAsyncPollUrl('https://fnuu.net/async/images', '47528f39a8644bdfae66dc0bb1f430dd', ''),
    'https://fnuu.net/async/images/47528f39a8644bdfae66dc0bb1f430dd',
  )
})

test('resolves documented async image polling URLs', () => {
  assert.equal(
    core.resolveAsyncPollUrl('https://fnuu.net', '47528f39a8644bdfae66dc0bb1f430dd', '/async/images/47528f39a8644bdfae66dc0bb1f430dd'),
    'https://fnuu.net/async/images/47528f39a8644bdfae66dc0bb1f430dd',
  )
  assert.equal(
    core.resolveAsyncPollUrl('https://fnuu.net/v1', '47528f39a8644bdfae66dc0bb1f430dd', ''),
    'https://fnuu.net/async/images/47528f39a8644bdfae66dc0bb1f430dd',
  )
})

test('expands auto protocol candidates in fallback order', () => {
  assert.deepEqual(core.protocolCandidates({ base_url: 'https://api.example.com', api_type: 'auto' }), ['openai', 'async', 'chat'])
  assert.deepEqual(core.protocolCandidates({ base_url: 'https://fnuu.net', api_type: 'auto' }), ['async', 'openai', 'chat'])
  assert.deepEqual(core.protocolCandidates({ base_url: 'https://api.example.com', api_type: 'chat' }), ['chat'])
})

test('extracts generated image links from common provider response shapes', () => {
  const dataUrl = core.toDataImageUrl('abc123', 'webp')
  assert.deepEqual(
    core.extractImageUrls({
      output_format: 'webp',
      data: [{ b64_json: 'abc123' }, { url: 'https://cdn.example.com/a.png' }],
    }),
    [dataUrl, 'https://cdn.example.com/a.png'],
  )
  assert.deepEqual(
    core.extractImageUrls({
      result: {
        images: ['https://cdn.example.com/b.webp'],
        output: [{ b64_json: 'zzz' }],
      },
    }),
    ['https://cdn.example.com/b.webp', 'data:image/png;base64,zzz'],
  )
  assert.deepEqual(
    core.extractImageUrls({
      choices: [{ message: { content: 'done https://cdn.example.com/c.jpg' } }],
    }),
    ['https://cdn.example.com/c.jpg'],
  )
})

test('prefers one provider URL when the same response item also includes b64 data', () => {
  assert.deepEqual(
    core.extractImageUrls({
      data: [
        {
          b64_json: 'same-image-inline-copy',
          url: 'https://aiapi1.cc.cd/generated/result.png',
        },
      ],
    }),
    ['https://aiapi1.cc.cd/generated/result.png'],
  )
})

test('pairs provider URL previews with inline data downloads', () => {
  assert.deepEqual(
    core.extractImageResults({
      output_format: 'webp',
      data: [
        {
          b64_json: 'same-image-inline-copy',
          url: 'https://aiapi1.cc.cd/generated/result.png',
        },
      ],
    }),
    [
      {
        url: 'https://aiapi1.cc.cd/generated/result.png',
        downloadUrl: 'data:image/webp;base64,same-image-inline-copy',
      },
    ],
  )
})

test('uses upstream expiry when present and otherwise falls back to one hour', () => {
  const now = Date.parse('2026-06-10T10:00:00.000Z')
  assert.equal(core.resolveExpiresAt('2026-06-10T11:30:00.000Z', now), '2026-06-10T11:30:00.000Z')
  assert.equal(core.resolveExpiresAt(null, now), '2026-06-10T11:00:00.000Z')
})

test('does not persist inline image data in saved result links', () => {
  const createdAt = '2026-06-10T10:00:00.000Z'
  const expiresAt = '2026-06-10T11:00:00.000Z'
  assert.deepEqual(
    core.persistableResultImages([
      { url: 'data:image/png;base64,abc', nodeName: 'A', protocol: 'openai', createdAt, expiresAt },
      {
        url: 'https://cdn.example.com/result.png',
        downloadUrl: 'data:image/png;base64,abc',
        nodeName: 'A',
        protocol: 'openai',
        createdAt,
        expiresAt,
      },
    ]),
    [{ url: 'https://cdn.example.com/result.png', nodeName: 'A', protocol: 'openai', createdAt, expiresAt }],
  )
})
