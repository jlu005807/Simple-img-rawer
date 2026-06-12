(function initStaticImageCore(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) {
    module.exports = api
  }
  root.StaticImageCore = api
})(typeof globalThis !== 'undefined' ? globalThis : window, function createStaticImageCore() {
  const KNOWN_ASYNC_RELAY_HOSTS = new Set(['fnuu.net', 'www.fnuu.net'])
  const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff']
  const IMAGE_URL_RE = /(?:https?:\/\/|data:image\/)[^\s"'<>\\)]+/gi
  const ONE_HOUR_MS = 60 * 60 * 1000

  const API_TYPE_ALIASES = {
    auto: 'auto',
    automatic: 'auto',
    detect: 'auto',
    autodetect: 'auto',
    openai: 'openai',
    'openai-compatible': 'openai',
    openai_compatible: 'openai',
    compatible: 'openai',
    images: 'openai',
    sync: 'openai',
    async: 'async',
    relay: 'async',
    async_images: 'async',
    custom: 'custom',
    manual: 'custom',
    direct: 'custom',
    raw: 'custom',
    chat: 'chat',
    chat_completions: 'chat',
    completions: 'chat',
  }

  function normalizeProtocol(value) {
    const key = String(value || 'auto').trim().toLowerCase()
    return API_TYPE_ALIASES[key] || 'auto'
  }

  function trimTrailingSlash(value) {
    return String(value || '').trim().replace(/\/+$/, '')
  }

  function openAiEndpoint(baseUrl, path) {
    const base = trimTrailingSlash(baseUrl)
    const cleanPath = String(path || '').replace(/^\/+/, '')
    if (base.toLowerCase().endsWith('/v1')) {
      return `${base}/${cleanPath}`
    }
    return `${base}/v1/${cleanPath}`
  }

  function asyncBaseUrl(baseUrl) {
    let base = trimTrailingSlash(baseUrl)
    if (base.toLowerCase().endsWith('/async/images')) {
      base = trimTrailingSlash(base.slice(0, -'/async/images'.length))
    }
    if (base.toLowerCase().endsWith('/v1')) {
      base = trimTrailingSlash(base.slice(0, -3))
    }
    return base
  }

  function urlHost(value) {
    try {
      return new URL(String(value || '')).hostname.toLowerCase()
    } catch {
      return ''
    }
  }

  function isKnownAsyncRelay(baseUrl) {
    return KNOWN_ASYNC_RELAY_HOSTS.has(urlHost(baseUrl))
  }

  function protocolCandidates(node) {
    const protocol = normalizeProtocol(node && node.api_type)
    if (protocol === 'auto') {
      return isKnownAsyncRelay(node && node.base_url) ? ['async', 'openai', 'chat'] : ['openai', 'async', 'chat']
    }
    return [protocol]
  }

  function requestUrlFor(node, protocol, options) {
    const nextProtocol = normalizeProtocol(protocol || (node && node.api_type))
    const baseUrl = trimTrailingSlash(node && node.base_url)
    const opts = options || {}
    if (nextProtocol === 'async') {
      return `${asyncBaseUrl(baseUrl)}/async/images`
    }
    if (nextProtocol === 'custom') {
      return baseUrl
    }
    if (nextProtocol === 'chat') {
      return openAiEndpoint(baseUrl, 'chat/completions')
    }
    const usesEditEndpoint = opts.operation === 'edit' || opts.hasReferences === true
    return openAiEndpoint(baseUrl, usesEditEndpoint ? 'images/edits' : 'images/generations')
  }

  function toDataImageUrl(base64Value, format) {
    const fmt = String(format || 'png').trim().toLowerCase().replace(/^image\//, '') || 'png'
    return `data:image/${fmt};base64,${String(base64Value || '').trim()}`
  }

  function looksLikeImageUrl(value) {
    try {
      const parsed = new URL(value)
      const path = parsed.pathname.toLowerCase()
      if (IMAGE_EXTENSIONS.some((ext) => path.endsWith(ext))) {
        return true
      }
      const query = decodeURIComponent(parsed.search || '').toLowerCase()
      return ['image/', 'format=png', 'format=jpg', 'format=jpeg', 'format=webp'].some((marker) =>
        query.includes(marker),
      )
    } catch {
      return false
    }
  }

  function extractImageResults(payload) {
    const images = []
    const seen = new Map()
    const responseDefaultFormat =
      payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.output_format : undefined

    function pushImage(url, downloadUrl) {
      if (!url || seen.has(url)) {
        if (downloadUrl && seen.has(url)) {
          const existing = images[seen.get(url)]
          if (!existing.downloadUrl) {
            existing.downloadUrl = downloadUrl
          }
        }
        return
      }
      const image = { url }
      if (downloadUrl && downloadUrl !== url) {
        image.downloadUrl = downloadUrl
      }
      seen.set(url, images.length)
      images.push(image)
    }

    function add(value, trustedHttp, downloadUrl) {
      if (typeof value !== 'string') {
        return
      }
      const text = value.trim().replace(/[.,;:\]}]+$/, '')
      if (!text) {
        return
      }
      if (text.startsWith('data:image/') && text.includes(';base64,')) {
        pushImage(text, downloadUrl)
        return
      }
      if (/^https?:\/\//i.test(text) && (trustedHttp || looksLikeImageUrl(text))) {
        pushImage(text, downloadUrl)
        return
      }
      for (const match of String(value).matchAll(IMAGE_URL_RE)) {
        add(match[0], false)
      }
    }

    function visit(value, key, inheritedFormat) {
      if (typeof value === 'string') {
        const trusted = ['url', 'urls', 'image', 'images', 'result', 'output'].includes(String(key || ''))
        add(value, trusted)
        return
      }
      if (Array.isArray(value)) {
        value.forEach((item) => visit(item, key, inheritedFormat))
        return
      }
      if (!value || typeof value !== 'object') {
        return
      }

      const localFormat = value.output_format || inheritedFormat || responseDefaultFormat || 'png'
      const inlineUrl =
        typeof value.b64_json === 'string' && value.b64_json.trim()
          ? toDataImageUrl(value.b64_json, localFormat)
          : ''
      if (typeof value.url === 'string') {
        add(value.url, true, inlineUrl)
      } else if (inlineUrl) {
        add(inlineUrl, true)
      }

      const keys = [
        'urls',
        'result',
        'data',
        'image',
        'images',
        'output',
        'choices',
        'message',
        'content',
        'text',
      ]
      keys.forEach((nestedKey) => {
        if (Object.prototype.hasOwnProperty.call(value, nestedKey)) {
          visit(value[nestedKey], nestedKey, localFormat)
        }
      })
    }

    visit(payload, '', responseDefaultFormat)
    return images
  }

  function extractImageUrls(payload) {
    return extractImageResults(payload).map((image) => image.url)
  }

  function unwrapResponseDataObject(data) {
    if (data && typeof data === 'object' && !Array.isArray(data) && data.data && typeof data.data === 'object') {
      if (!Array.isArray(data.data)) {
        return data.data
      }
    }
    return data
  }

  function resolveAsyncPollUrl(baseUrl, taskId, pollUrl) {
    const raw = String(pollUrl || '').trim()
    if (/^https?:\/\//i.test(raw)) {
      return raw
    }
    const base = asyncBaseUrl(baseUrl)
    if (raw.startsWith('/')) {
      try {
        const parsed = new URL(base)
        return `${parsed.protocol}//${parsed.host}${raw}`
      } catch {
        return `${base}${raw}`
      }
    }
    if (raw) {
      return `${trimTrailingSlash(base)}/${raw.replace(/^\/+/, '')}`
    }
    return `${trimTrailingSlash(base)}/async/images/${encodeURIComponent(String(taskId || ''))}`
  }

  function resolveExpiresAt(upstreamExpiresAt, now) {
    if (upstreamExpiresAt !== null && upstreamExpiresAt !== undefined && upstreamExpiresAt !== '') {
      let parsed
      if (typeof upstreamExpiresAt === 'number') {
        parsed = upstreamExpiresAt < 100000000000 ? upstreamExpiresAt * 1000 : upstreamExpiresAt
      } else {
        parsed = Date.parse(String(upstreamExpiresAt))
      }
      if (Number.isFinite(parsed) && parsed > 0) {
        return new Date(parsed).toISOString()
      }
    }
    const base = Number.isFinite(now) ? Number(now) : Date.now()
    return new Date(base + ONE_HOUR_MS).toISOString()
  }

  function persistableResultImages(images) {
    return (Array.isArray(images) ? images : [])
      .filter((item) => {
        const url = String((item && item.url) || '').trim()
        return url && !url.startsWith('data:image/')
      })
      .map((item) => ({
        url: String(item.url).trim(),
        nodeName: item.nodeName || '',
        protocol: item.protocol || '',
        createdAt: item.createdAt || '',
        expiresAt: item.expiresAt || '',
      }))
  }

  function resultDisplayUrl(item) {
    const inline = String((item && item.downloadUrl) || '').trim()
    if (inline.startsWith('data:image/')) {
      return inline
    }
    return String((item && item.url) || '').trim()
  }

  function normalizeNode(raw) {
    const source = raw || {}
    return {
      id: String(source.id || '').trim() || createId('node'),
      name: String(source.name || '').trim(),
      base_url: trimTrailingSlash(source.base_url),
      api_key: String(source.api_key || '').trim(),
      model: String(source.model || 'gpt-image-2').trim(),
      api_type: normalizeProtocol(source.api_type),
      status: source.status !== false,
      timeout_seconds: normalizePositiveInt(source.timeout_seconds, 180),
      retry_count: normalizeNonNegativeInt(source.retry_count, 0),
    }
  }

  function validateNode(raw) {
    const node = normalizeNode(raw)
    const errors = []
    if (!node.name) {
      errors.push('请填写节点名称')
    }
    if (!/^https?:\/\//i.test(node.base_url)) {
      errors.push('base_url 必须以 http:// 或 https:// 开头')
    }
    if (!node.api_key) {
      errors.push('请填写 API Key')
    }
    if (!node.model) {
      errors.push('请填写模型名称')
    }
    return errors
  }

  function normalizePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback
    }
    return parsed
  }

  function normalizeNonNegativeInt(value, fallback) {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed < 0) {
      return fallback
    }
    return parsed
  }

  function createId(prefix) {
    const safePrefix = String(prefix || 'id').replace(/[^a-z0-9_-]/gi, '') || 'id'
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `${safePrefix}-${crypto.randomUUID()}`
    }
    return `${safePrefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }

  function maskKey(value) {
    const text = String(value || '')
    if (!text) {
      return ''
    }
    if (text.length <= 4) {
      return '••••'
    }
    return `••••${text.slice(-4)}`
  }

  return {
    ONE_HOUR_MS,
    asyncBaseUrl,
    createId,
    extractImageResults,
    extractImageUrls,
    maskKey,
    normalizeNode,
    normalizeProtocol,
    openAiEndpoint,
    persistableResultImages,
    protocolCandidates,
    requestUrlFor,
    resolveAsyncPollUrl,
    resolveExpiresAt,
    resultDisplayUrl,
    toDataImageUrl,
    unwrapResponseDataObject,
    validateNode,
  }
})
