(function initStaticImageApp() {
  const core = window.StaticImageCore
  if (!core) {
    throw new Error('StaticImageCore is required')
  }

  const STORAGE_KEYS = {
    nodes: 'simple-img-static.nodes.v1',
    draft: 'simple-img-static.draft.v1',
    links: 'simple-img-static.links.v1',
  }

  const state = {
    nodes: [],
    editingNodeId: '',
    references: [],
    results: [],
    activeResultId: '',
    attempts: [],
    running: false,
    abortController: null,
  }

  const elements = {}
  let clockTimer = null

  document.addEventListener('DOMContentLoaded', init)

  function init() {
    bindElements()
    bindEvents()
    state.nodes = loadNodes()
    state.results = loadSavedLinks()
    restoreDraft()
    renderNodes()
    renderReferences()
    renderAttempts()
    renderResults()
    startClock()
    setStatus('待命：填写节点后即可生成', 'idle')
  }

  function bindElements() {
    Object.assign(elements, {
      nodeForm: document.querySelector('#node-form'),
      nodeId: document.querySelector('#node-id'),
      nodeName: document.querySelector('#node-name'),
      nodeBaseUrl: document.querySelector('#node-base-url'),
      nodeApiKey: document.querySelector('#node-api-key'),
      nodeModel: document.querySelector('#node-model'),
      nodeProtocol: document.querySelector('#node-protocol'),
      nodeEnabled: document.querySelector('#node-enabled'),
      nodeTimeout: document.querySelector('#node-timeout'),
      nodeRetry: document.querySelector('#node-retry'),
      saveNode: document.querySelector('#save-node'),
      resetNode: document.querySelector('#reset-node'),
      revealKey: document.querySelector('#reveal-key'),
      nodeList: document.querySelector('#node-list'),
      nodeCount: document.querySelector('#node-count'),
      generationForm: document.querySelector('#generation-form'),
      prompt: document.querySelector('#prompt'),
      size: document.querySelector('#size'),
      quality: document.querySelector('#quality'),
      imageCount: document.querySelector('#image-count'),
      referenceInput: document.querySelector('#reference-input'),
      referenceList: document.querySelector('#reference-list'),
      clearReferences: document.querySelector('#clear-references'),
      generate: document.querySelector('#generate'),
      stop: document.querySelector('#stop'),
      statusText: document.querySelector('#status-text'),
      attempts: document.querySelector('#attempt-list'),
      resultGrid: document.querySelector('#result-grid'),
      resultPreview: document.querySelector('#result-preview'),
      resultEmpty: document.querySelector('#result-empty'),
      resultMeta: document.querySelector('#result-meta'),
      resultLink: document.querySelector('#result-link'),
      copyLink: document.querySelector('#copy-link'),
      openOriginal: document.querySelector('#open-original'),
      download: document.querySelector('#download'),
      clearLinks: document.querySelector('#clear-links'),
      resultActions: document.querySelector('#result-actions'),
    })
  }

  function bindEvents() {
    elements.nodeForm.addEventListener('submit', onNodeSubmit)
    elements.resetNode.addEventListener('click', resetNodeForm)
    elements.revealKey.addEventListener('click', toggleKeyVisibility)
    elements.nodeList.addEventListener('click', onNodeAction)
    elements.generationForm.addEventListener('submit', onGenerateSubmit)
    elements.prompt.addEventListener('input', saveDraft)
    elements.size.addEventListener('change', saveDraft)
    elements.quality.addEventListener('change', saveDraft)
    elements.imageCount.addEventListener('input', saveDraft)
    elements.referenceInput.addEventListener('change', onReferenceInput)
    elements.clearReferences.addEventListener('click', clearReferences)
    elements.stop.addEventListener('click', stopGeneration)
    elements.resultGrid.addEventListener('click', onResultSelect)
    elements.copyLink.addEventListener('click', copyActiveLink)
    elements.openOriginal.addEventListener('click', openActiveOriginal)
    elements.download.addEventListener('click', downloadActiveImage)
    elements.clearLinks.addEventListener('click', clearStoredLinks)
  }

  function onNodeSubmit(event) {
    event.preventDefault()
    const raw = readNodeForm()
    const errors = core.validateNode(raw)
    if (errors.length) {
      setStatus(errors[0], 'error')
      return
    }

    const node = core.normalizeNode(raw)
    const index = state.nodes.findIndex((item) => item.id === node.id)
    if (index >= 0) {
      state.nodes.splice(index, 1, node)
      setStatus(`已更新节点：${node.name}`, 'ok')
    } else {
      state.nodes.push(node)
      setStatus(`已保存节点：${node.name}`, 'ok')
    }
    saveNodes()
    resetNodeForm()
    renderNodes()
  }

  function readNodeForm() {
    return {
      id: elements.nodeId.value,
      name: elements.nodeName.value,
      base_url: elements.nodeBaseUrl.value,
      api_key: elements.nodeApiKey.value,
      model: elements.nodeModel.value,
      api_type: elements.nodeProtocol.value,
      status: elements.nodeEnabled.checked,
      timeout_seconds: elements.nodeTimeout.value,
      retry_count: elements.nodeRetry.value,
    }
  }

  function resetNodeForm() {
    state.editingNodeId = ''
    elements.nodeId.value = ''
    elements.nodeName.value = ''
    elements.nodeBaseUrl.value = ''
    elements.nodeApiKey.value = ''
    elements.nodeApiKey.type = 'password'
    elements.nodeModel.value = 'gpt-image-2'
    elements.nodeProtocol.value = 'auto'
    elements.nodeEnabled.checked = true
    elements.nodeTimeout.value = '180'
    elements.nodeRetry.value = '0'
    elements.saveNode.textContent = '保存节点'
  }

  function fillNodeForm(node) {
    state.editingNodeId = node.id
    elements.nodeId.value = node.id
    elements.nodeName.value = node.name
    elements.nodeBaseUrl.value = node.base_url
    elements.nodeApiKey.value = node.api_key
    elements.nodeApiKey.type = 'password'
    elements.nodeModel.value = node.model
    elements.nodeProtocol.value = node.api_type
    elements.nodeEnabled.checked = node.status
    elements.nodeTimeout.value = String(node.timeout_seconds)
    elements.nodeRetry.value = String(node.retry_count)
    elements.saveNode.textContent = '更新节点'
  }

  function toggleKeyVisibility() {
    elements.nodeApiKey.type = elements.nodeApiKey.type === 'password' ? 'text' : 'password'
  }

  function onNodeAction(event) {
    const button = event.target.closest('[data-node-action]')
    if (!button) {
      return
    }
    const id = button.getAttribute('data-node-id')
    const action = button.getAttribute('data-node-action')
    const index = state.nodes.findIndex((item) => item.id === id)
    if (index < 0) {
      return
    }
    if (action === 'edit') {
      fillNodeForm(state.nodes[index])
      return
    }
    if (action === 'toggle') {
      state.nodes[index].status = !state.nodes[index].status
      saveNodes()
      renderNodes()
      return
    }
    if (action === 'up' && index > 0) {
      const [node] = state.nodes.splice(index, 1)
      state.nodes.splice(index - 1, 0, node)
      saveNodes()
      renderNodes()
      return
    }
    if (action === 'down' && index < state.nodes.length - 1) {
      const [node] = state.nodes.splice(index, 1)
      state.nodes.splice(index + 1, 0, node)
      saveNodes()
      renderNodes()
      return
    }
    if (action === 'delete') {
      state.nodes.splice(index, 1)
      if (state.editingNodeId === id) {
        resetNodeForm()
      }
      saveNodes()
      renderNodes()
      setStatus('节点已删除', 'idle')
    }
  }

  async function onReferenceInput(event) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'))
    for (const file of files) {
      if (state.references.length >= 8) {
        setStatus('参考图最多 8 张', 'error')
        break
      }
      const url = await readFileAsDataUrl(file)
      state.references.push({ id: core.createId('ref'), file, url, name: file.name })
    }
    event.target.value = ''
    renderReferences()
  }

  function clearReferences() {
    state.references = []
    renderReferences()
  }

  async function onGenerateSubmit(event) {
    event.preventDefault()
    if (state.running) {
      return
    }

    const payload = readGenerationForm()
    if (!payload.prompt) {
      setStatus('请填写提示词', 'error')
      elements.prompt.focus()
      return
    }
    const enabledNodes = state.nodes.filter((node) => node.status)
    if (!enabledNodes.length) {
      setStatus('请先保存并启用至少一个 API 节点', 'error')
      return
    }

    setRunning(true)
    state.attempts = []
    renderAttempts()
    state.abortController = new AbortController()
    const startedAt = Date.now()
    setStatus('正在提交生成请求', 'running')

    try {
      const result = await runWithFallback(enabledNodes, payload, state.references, state.abortController.signal)
      const createdAt = new Date().toISOString()
      const resultItems = result.urls.map((url, index) => ({
        id: core.createId('result'),
        url,
        nodeName: result.node.name,
        nodeId: result.node.id,
        protocol: result.protocol,
        createdAt,
        expiresAt: core.resolveExpiresAt(result.expiresAt, Date.now()),
        requestUrl: result.requestUrl,
        index,
      }))
      state.results = [...resultItems, ...state.results].filter((item) => !isExpired(item))
      state.activeResultId = resultItems[0] ? resultItems[0].id : ''
      saveLinks()
      renderResults()
      const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
      setStatus(`生成完成：${result.urls.length} 张图片，耗时 ${seconds}s。请在一小时内下载。`, 'ok')
    } catch (error) {
      if (state.abortController && state.abortController.signal.aborted) {
        setStatus('已停止当前生成', 'idle')
      } else {
        setStatus(error.message || '生成失败', 'error')
      }
    } finally {
      setRunning(false)
      state.abortController = null
    }
  }

  function readGenerationForm() {
    return {
      prompt: elements.prompt.value.trim(),
      size: elements.size.value,
      quality: elements.quality.value,
      n: Math.max(1, Math.min(4, Number.parseInt(elements.imageCount.value, 10) || 1)),
    }
  }

  async function runWithFallback(nodes, payload, references, signal) {
    for (const node of nodes) {
      const candidates = core.protocolCandidates(node)
      for (const protocol of candidates) {
        const retries = Math.max(0, Number.parseInt(node.retry_count, 10) || 0)
        for (let attemptIndex = 0; attemptIndex <= retries; attemptIndex += 1) {
          throwIfAborted(signal)
          const requestUrl = core.requestUrlFor(node, protocol, { hasReferences: references.length > 0 })
          const attemptId = addAttempt({
            nodeName: node.name,
            protocol,
            requestUrl,
            status: 'running',
            message: `第 ${attemptIndex + 1}/${retries + 1} 次`,
          })
          try {
            const result = await runCandidate(node, protocol, payload, references, signal)
            if (!result.urls.length) {
              throw new Error('节点响应中没有图片链接')
            }
            updateAttempt(attemptId, { status: 'ok', message: `返回 ${result.urls.length} 张图片` })
            return { ...result, node, protocol }
          } catch (error) {
            if (signal.aborted) {
              updateAttempt(attemptId, { status: 'stopped', message: '已停止' })
              throw error
            }
            updateAttempt(attemptId, { status: 'error', message: error.message || '请求失败' })
          }
        }
      }
    }
    throw new Error('所有启用节点都未成功返回图片')
  }

  async function runCandidate(node, protocol, payload, references, signal) {
    if (protocol === 'async') {
      return runAsyncProvider(node, payload, references, signal)
    }
    if (protocol === 'chat') {
      return runChatProvider(node, payload, references, signal)
    }
    if (protocol === 'custom') {
      return runCustomProvider(node, payload, references, signal)
    }
    return runOpenAiProvider(node, payload, references, signal)
  }

  async function runOpenAiProvider(node, payload, references, signal) {
    const hasReferences = references.length > 0
    const url = core.requestUrlFor(node, 'openai', { hasReferences })
    const headers = authHeaders(node, !hasReferences)
    let body
    if (hasReferences) {
      body = new FormData()
      body.append('model', node.model)
      body.append('prompt', payload.prompt)
      body.append('n', String(payload.n))
      if (payload.size !== 'auto') {
        body.append('size', payload.size)
      }
      if (payload.quality) {
        body.append('quality', payload.quality)
      }
      references.forEach((item) => body.append('image[]', item.file, item.file.name || 'reference.png'))
    } else {
      body = JSON.stringify(cleanBody({
        model: node.model,
        prompt: payload.prompt,
        n: payload.n,
        size: payload.size === 'auto' ? undefined : payload.size,
        quality: payload.quality || undefined,
      }))
    }
    const response = await fetchWithTimeout(url, { method: 'POST', headers, body }, node.timeout_seconds, signal)
    const data = await parseProviderResponse(response, node)
    ensureProviderOk(response, data, node)
    return finalizeProviderData(data, url)
  }

  async function runChatProvider(node, payload, references, signal) {
    const url = core.requestUrlFor(node, 'chat')
    const content = references.length
      ? [
          { type: 'text', text: payload.prompt },
          ...references.map((item) => ({ type: 'image_url', image_url: { url: item.url } })),
        ]
      : payload.prompt
    const body = {
      model: node.model,
      messages: [{ role: 'user', content }],
    }
    const response = await fetchWithTimeout(
      url,
      { method: 'POST', headers: authHeaders(node, true), body: JSON.stringify(body) },
      node.timeout_seconds,
      signal,
    )
    const data = await parseProviderResponse(response, node)
    ensureProviderOk(response, data, node)
    return finalizeProviderData(data, url)
  }

  async function runCustomProvider(node, payload, references, signal) {
    const url = core.requestUrlFor(node, 'custom')
    const body = cleanBody({
      model: node.model,
      prompt: payload.prompt,
      n: payload.n,
      size: payload.size === 'auto' ? undefined : payload.size,
      quality: payload.quality || undefined,
      reference_images: references.length ? references.map((item) => item.url) : undefined,
    })
    const response = await fetchWithTimeout(
      url,
      { method: 'POST', headers: authHeaders(node, true), body: JSON.stringify(body) },
      node.timeout_seconds,
      signal,
    )
    const data = await parseProviderResponse(response, node)
    ensureProviderOk(response, data, node)
    return finalizeProviderData(data, url)
  }

  async function runAsyncProvider(node, payload, references, signal) {
    const submitUrl = core.requestUrlFor(node, 'async')
    const body = cleanBody({
      model: node.model,
      prompt: payload.prompt,
      n: payload.n,
      size: payload.size === 'auto' ? undefined : payload.size,
      quality: payload.quality || undefined,
      reference_images: references.length ? references.map((item) => item.url) : undefined,
    })
    const submitResponse = await fetchWithTimeout(
      submitUrl,
      { method: 'POST', headers: authHeaders(node, true), body: JSON.stringify(body) },
      node.timeout_seconds,
      signal,
    )
    const submitData = await parseProviderResponse(submitResponse, node)
    ensureProviderOk(submitResponse, submitData, node)
    const immediate = finalizeProviderData(submitData, submitUrl)
    const submitObject = core.unwrapResponseDataObject(normalizeProviderEnvelope(submitData))
    const submitStatus = String((submitObject && submitObject.status) || '').toLowerCase()
    if (immediate.urls.length && (!submitObject.task_id || submitStatus === 'completed')) {
      return immediate
    }

    const taskId = submitObject && (submitObject.task_id || submitObject.id)
    if (!taskId) {
      throw new Error('异步节点未返回 task_id')
    }
    const pollUrl = isFnuu(node.base_url)
      ? `${core.asyncBaseUrl(node.base_url)}/async/task/${encodeURIComponent(taskId)}`
      : core.resolveAsyncPollUrl(node.base_url, taskId, submitObject.poll_url)

    let pollCount = 0
    while (true) {
      throwIfAborted(signal)
      pollCount += 1
      setStatus(`异步任务处理中：${node.name}，轮询 ${pollCount} 次`, 'running')
      await sleep(4000, signal)
      const pollResponse = await fetchWithTimeout(
        pollUrl,
        { method: 'GET', headers: authHeaders(node, false) },
        node.timeout_seconds,
        signal,
      )
      const pollData = await parseProviderResponse(pollResponse, node)
      const pollObject = core.unwrapResponseDataObject(normalizeProviderEnvelope(pollData))
      const status = String((pollObject && pollObject.status) || '').toLowerCase()
      if (status === 'failed') {
        throw new Error(errorMessageFromPayload(pollObject) || '异步任务失败')
      }
      if (status === 'completed') {
        const completed = finalizeProviderData(pollData, pollUrl)
        if (!completed.urls.length) {
          throw new Error('异步任务完成但没有返回图片 URL')
        }
        return completed
      }
      const maybeUrls = finalizeProviderData(pollData, pollUrl)
      if (maybeUrls.urls.length && !status) {
        return maybeUrls
      }
    }
  }

  function finalizeProviderData(data, requestUrl) {
    const payload = normalizeProviderEnvelope(data)
    const unwrapped = core.unwrapResponseDataObject(payload)
    const expiresAt =
      (payload && (payload.expires_at || payload.expiresAt)) ||
      (unwrapped && (unwrapped.expires_at || unwrapped.expiresAt)) ||
      null
    return {
      urls: core.extractImageUrls(payload),
      expiresAt,
      requestUrl,
    }
  }

  function normalizeProviderEnvelope(data) {
    if (data && typeof data === 'object' && data.success === true && Object.prototype.hasOwnProperty.call(data, 'data')) {
      return data.data
    }
    return data
  }

  async function parseProviderResponse(response, node) {
    const text = await response.text()
    if (!text.trim()) {
      return {}
    }
    try {
      return JSON.parse(text)
    } catch {
      const urls = core.extractImageUrls(text)
      if (urls.length && response.ok) {
        return { data: urls.map((url) => ({ url })), non_json_url_fallback: true }
      }
      throw new Error(`${node.name} 返回了非 JSON 响应：${text.slice(0, 120)}`)
    }
  }

  function ensureProviderOk(response, data, node) {
    const payload = normalizeProviderEnvelope(data)
    if (!response.ok || (data && data.success === false)) {
      const message = errorMessageFromPayload(data) || `HTTP ${response.status}`
      throw new Error(`${node.name}: ${message}`)
    }
    const payloadStatus = String((payload && payload.status) || '').toLowerCase()
    if (payloadStatus === 'failed') {
      throw new Error(errorMessageFromPayload(payload) || `${node.name}: 任务失败`)
    }
  }

  function errorMessageFromPayload(value) {
    if (!value || typeof value !== 'object') {
      return typeof value === 'string' ? value : ''
    }
    const error = value.error
    if (typeof error === 'string') {
      return error
    }
    if (error && typeof error === 'object') {
      return error.message || error.detail || JSON.stringify(error).slice(0, 180)
    }
    return value.message || value.detail || ''
  }

  function authHeaders(node, jsonContent) {
    const headers = {
      Authorization: `Bearer ${node.api_key}`,
      Accept: 'application/json',
    }
    if (jsonContent) {
      headers['Content-Type'] = 'application/json'
    }
    return headers
  }

  function cleanBody(body) {
    return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined && value !== ''))
  }

  async function fetchWithTimeout(url, options, seconds, parentSignal) {
    const controller = new AbortController()
    let timedOut = false
    const timeoutMs = Math.max(1, Number(seconds) || 180) * 1000
    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    const abortFromParent = () => controller.abort()
    if (parentSignal) {
      if (parentSignal.aborted) {
        controller.abort()
      } else {
        parentSignal.addEventListener('abort', abortFromParent, { once: true })
      }
    }
    try {
      return await fetch(url, { ...options, signal: controller.signal })
    } catch (error) {
      if (parentSignal && parentSignal.aborted) {
        throw new Error('已停止')
      }
      if (timedOut) {
        throw new Error(`请求超时（${Math.round(timeoutMs / 1000)}s）`)
      }
      if (String(error && error.message).includes('Failed to fetch')) {
        throw new Error('请求失败，可能是节点未开启 CORS 或网络不可达')
      }
      throw error
    } finally {
      window.clearTimeout(timeoutId)
      if (parentSignal) {
        parentSignal.removeEventListener('abort', abortFromParent)
      }
    }
  }

  function stopGeneration() {
    if (state.abortController) {
      state.abortController.abort()
    }
  }

  function setRunning(value) {
    state.running = value
    elements.generate.disabled = value
    elements.stop.disabled = !value
    elements.nodeForm.querySelectorAll('input, select, button').forEach((control) => {
      if (control !== elements.resetNode && control !== elements.revealKey) {
        control.disabled = value
      }
    })
  }

  function addAttempt(attempt) {
    const id = core.createId('attempt')
    state.attempts.push({ id, ...attempt, time: Date.now() })
    renderAttempts()
    return id
  }

  function updateAttempt(id, patch) {
    const item = state.attempts.find((attempt) => attempt.id === id)
    if (item) {
      Object.assign(item, patch)
      renderAttempts()
    }
  }

  function renderAttempts() {
    if (!state.attempts.length) {
      elements.attempts.innerHTML = '<li class="muted-row">暂无请求记录</li>'
      return
    }
    elements.attempts.innerHTML = state.attempts
      .map(
        (attempt) => `
          <li class="attempt attempt-${escapeHtml(attempt.status)}">
            <span class="attempt-dot"></span>
            <div class="attempt-main">
              <strong>${escapeHtml(attempt.nodeName)} · ${protocolLabel(attempt.protocol)}</strong>
              <span>${escapeHtml(attempt.message || '')}</span>
              <code>${escapeHtml(attempt.requestUrl || '')}</code>
            </div>
          </li>
        `,
      )
      .join('')
  }

  function renderNodes() {
    const enabledCount = state.nodes.filter((node) => node.status).length
    elements.nodeCount.textContent = `${enabledCount}/${state.nodes.length} 启用`
    if (!state.nodes.length) {
      elements.nodeList.innerHTML = '<li class="empty-list">还没有 API 节点</li>'
      return
    }
    elements.nodeList.innerHTML = state.nodes
      .map(
        (node, index) => `
          <li class="node-item ${node.status ? '' : 'node-disabled'}">
            <div class="node-rank">${index + 1}</div>
            <div class="node-body">
              <div class="node-title">
                <strong>${escapeHtml(node.name)}</strong>
                <span>${protocolLabel(node.api_type)}</span>
              </div>
              <code>${escapeHtml(node.base_url)}</code>
              <div class="node-meta">
                <span>${escapeHtml(node.model)}</span>
                <span>${escapeHtml(core.maskKey(node.api_key))}</span>
                <span>${node.timeout_seconds}s</span>
              </div>
            </div>
            <div class="node-actions">
              <button type="button" title="上移" data-node-action="up" data-node-id="${escapeHtml(node.id)}">↑</button>
              <button type="button" title="下移" data-node-action="down" data-node-id="${escapeHtml(node.id)}">↓</button>
              <button type="button" title="${node.status ? '禁用' : '启用'}" data-node-action="toggle" data-node-id="${escapeHtml(node.id)}">${node.status ? '●' : '○'}</button>
              <button type="button" title="编辑" data-node-action="edit" data-node-id="${escapeHtml(node.id)}">✎</button>
              <button type="button" title="删除" data-node-action="delete" data-node-id="${escapeHtml(node.id)}">×</button>
            </div>
          </li>
        `,
      )
      .join('')
  }

  function renderReferences() {
    elements.clearReferences.disabled = state.references.length === 0
    if (!state.references.length) {
      elements.referenceList.innerHTML = '<div class="reference-empty">未选择参考图</div>'
      return
    }
    elements.referenceList.innerHTML = state.references
      .map(
        (item, index) => `
          <figure class="reference-thumb">
            <img src="${escapeAttribute(item.url)}" alt="${escapeAttribute(item.name)}">
            <figcaption>${index + 1}</figcaption>
          </figure>
        `,
      )
      .join('')
  }

  function renderResults() {
    state.results = state.results.filter((item) => !isExpired(item))
    if (!state.results.length) {
      state.activeResultId = ''
      elements.resultGrid.innerHTML = '<div class="result-placeholder">生成后显示图片链接</div>'
      elements.resultPreview.removeAttribute('src')
      elements.resultPreview.hidden = true
      elements.resultEmpty.hidden = false
      elements.resultMeta.textContent = '无结果'
      elements.resultLink.value = ''
      elements.resultActions.hidden = true
      saveLinks()
      return
    }
    if (!state.results.some((item) => item.id === state.activeResultId)) {
      state.activeResultId = state.results[0].id
    }
    elements.resultGrid.innerHTML = state.results
      .map(
        (item) => `
          <button type="button" class="result-tile ${item.id === state.activeResultId ? 'active' : ''}" data-result-id="${escapeAttribute(item.id)}">
            <img src="${escapeAttribute(item.url)}" alt="生成图片">
            <span>${timeLeftLabel(item.expiresAt)}</span>
          </button>
        `,
      )
      .join('')
    const active = activeResult()
    if (!active) {
      return
    }
    elements.resultPreview.src = active.url
    elements.resultPreview.hidden = false
    elements.resultEmpty.hidden = true
    elements.resultMeta.textContent = `${active.nodeName || '未知节点'} · ${protocolLabel(active.protocol)} · ${timeLeftLabel(active.expiresAt)}`
    elements.resultLink.value = active.url
    elements.resultActions.hidden = false
  }

  function onResultSelect(event) {
    const button = event.target.closest('[data-result-id]')
    if (!button) {
      return
    }
    state.activeResultId = button.getAttribute('data-result-id')
    renderResults()
  }

  async function copyActiveLink() {
    const active = activeResult()
    if (!active) {
      return
    }
    try {
      await navigator.clipboard.writeText(active.url)
      setStatus('链接已复制', 'ok')
    } catch {
      elements.resultLink.select()
      document.execCommand('copy')
      setStatus('链接已复制', 'ok')
    }
  }

  function openActiveOriginal() {
    const active = activeResult()
    if (!active) {
      return
    }
    window.open(active.url, '_blank', 'noopener,noreferrer')
  }

  async function downloadActiveImage() {
    const active = activeResult()
    if (!active) {
      return
    }
    const filename = `generated-${new Date().toISOString().replace(/[:.]/g, '-')}.${extensionForUrl(active.url)}`
    if (active.url.startsWith('data:image/')) {
      triggerDownload(active.url, filename)
      return
    }
    try {
      const response = await fetch(active.url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      triggerDownload(objectUrl, filename)
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch {
      setStatus('跨域链接无法直接下载，已打开原图', 'error')
      openActiveOriginal()
    }
  }

  function triggerDownload(url, filename) {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  function clearStoredLinks() {
    state.results = state.results.filter((item) => item.url.startsWith('data:image/'))
    state.activeResultId = state.results[0] ? state.results[0].id : ''
    saveLinks()
    renderResults()
    setStatus('已清理本地保存的结果链接', 'idle')
  }

  function activeResult() {
    return state.results.find((item) => item.id === state.activeResultId) || null
  }

  function saveDraft() {
    saveJson(STORAGE_KEYS.draft, readGenerationForm())
  }

  function restoreDraft() {
    const draft = loadJson(STORAGE_KEYS.draft, null)
    if (!draft || typeof draft !== 'object') {
      return
    }
    elements.prompt.value = draft.prompt || ''
    elements.size.value = draft.size || '1024x1024'
    elements.quality.value = draft.quality || ''
    elements.imageCount.value = draft.n || 1
  }

  function loadNodes() {
    return loadJson(STORAGE_KEYS.nodes, []).map((item) => core.normalizeNode(item))
  }

  function saveNodes() {
    saveJson(STORAGE_KEYS.nodes, state.nodes)
  }

  function loadSavedLinks() {
    return loadJson(STORAGE_KEYS.links, [])
      .filter((item) => item && item.url && !isExpired(item))
      .map((item) => ({
        ...item,
        id: item.id || core.createId('result'),
      }))
  }

  function saveLinks() {
    const persistable = core.persistableResultImages(state.results).map((item) => ({
      ...item,
      id: state.results.find((result) => result.url === item.url)?.id || core.createId('result'),
    }))
    saveJson(STORAGE_KEYS.links, persistable)
  }

  function loadJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  }

  function saveJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      setStatus('浏览器本地存储写入失败', 'error')
    }
  }

  function setStatus(message, level) {
    elements.statusText.textContent = message
    elements.statusText.dataset.level = level || 'idle'
  }

  function startClock() {
    if (clockTimer) {
      return
    }
    clockTimer = window.setInterval(renderResults, 1000)
  }

  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      const id = window.setTimeout(resolve, ms)
      const onAbort = () => {
        window.clearTimeout(id)
        reject(new Error('已停止'))
      }
      if (signal) {
        if (signal.aborted) {
          onAbort()
        } else {
          signal.addEventListener('abort', onAbort, { once: true })
        }
      }
    })
  }

  function throwIfAborted(signal) {
    if (signal && signal.aborted) {
      throw new Error('已停止')
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('读取参考图失败'))
      reader.readAsDataURL(file)
    })
  }

  function isExpired(item) {
    const expiresAt = Date.parse(item && item.expiresAt)
    return Number.isFinite(expiresAt) && expiresAt <= Date.now()
  }

  function timeLeftLabel(expiresAt) {
    const diff = Date.parse(expiresAt) - Date.now()
    if (!Number.isFinite(diff) || diff <= 0) {
      return '已过期'
    }
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }

  function extensionForUrl(url) {
    if (url.startsWith('data:image/')) {
      const match = /^data:image\/([^;,]+)/i.exec(url)
      return (match && match[1] === 'jpeg' ? 'jpg' : match && match[1]) || 'png'
    }
    try {
      const pathname = new URL(url).pathname
      const match = /\.([a-z0-9]+)$/i.exec(pathname)
      return match ? match[1].toLowerCase() : 'png'
    } catch {
      return 'png'
    }
  }

  function isFnuu(baseUrl) {
    try {
      const host = new URL(baseUrl).hostname.toLowerCase()
      return host === 'fnuu.net' || host === 'www.fnuu.net'
    } catch {
      return false
    }
  }

  function protocolLabel(value) {
    const protocol = core.normalizeProtocol(value)
    if (protocol === 'auto') return '自动'
    if (protocol === 'openai') return 'OpenAI'
    if (protocol === 'chat') return 'Chat'
    if (protocol === 'custom') return '自定义'
    if (protocol === 'async') return '异步'
    return protocol
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;')
  }
})()
