import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const transportMocks = vi.hoisted(() => ({
  rawFetch: vi.fn(),
  tauriFetch: vi.fn(),
  recordApiError: vi.fn(),
  isTauri: false,
  i18nTranslations: new Map<string, string>([
    ['errors.api.RATE_LIMIT', 'Rate limit exceeded'],
    ['errors.CUSTOM_CODE', 'Custom code error'],
    ['errors.aiServer', 'AI server error'],
    ['errors.server500', 'Internal server error'],
    ['errors.network', 'Network error'],
  ]),
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: transportMocks.tauriFetch,
}))

vi.mock('~/01.shared/lib/env', () => ({
  API_URL: 'https://api.example.test',
  get isTauri() {
    return transportMocks.isTauri
  },
}))

vi.mock('~/01.shared/lib/helpers', () => ({
  getMediaUrl: (path: string) => `https://cdn.example.test${path}`,
}))

vi.mock('~/01.shared/services/monitoring.service', () => ({
  recordApiError: transportMocks.recordApiError,
}))

vi.mock('../../00.plugins/i18n', () => ({
  i18n: {
    global: {
      te: (key: string) => transportMocks.i18nTranslations.has(key),
      t: (key: string) => transportMocks.i18nTranslations.get(key) ?? key,
    },
  },
}))

vi.mock('./api-transport.service', () => ({
  createApiFetch: () => transportMocks.rawFetch,
}))

function jsonResponse(body: unknown, status = 200, statusText = 'OK') {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('api service', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()
    transportMocks.isTauri = false
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })

    const { configureApi } = await import('./api.service')
    configureApi({
      getToken: () => localStorage.getItem('insight_token'),
      getAppLanguage: () => 'ru',
      getCustomLlm: () => null,
      onUnauthorized: () => {},
      onError: () => {},
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('injects Authorization, targetLang query, and custom LLM headers when configured', async () => {
    const { api, configureApi } = await import('./api.service')
    configureApi({
      getToken: () => 'secret-token',
      getAppLanguage: () => 'en',
      getCustomLlm: () => ({ url: 'https://llm.test', key: 'k-1', model: 'gpt-test' }),
    })

    transportMocks.rawFetch.mockResolvedValueOnce(jsonResponse({ translation: 'ok' }))
    await api.books.analyze(
      5,
      'Hello',
      'zh',
      'Context',
      undefined,
      'sentence',
    )

    const [url, init] = transportMocks.rawFetch.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(init.headers)
    expect(url).toContain('/api/books/5/analyze')
    expect(url).toContain('targetLang=en')
    expect(headers.get('Authorization')).toBe('Bearer secret-token')
    expect(headers.get('X-Custom-Llm-Url')).toBe('https://llm.test')
    expect(headers.get('X-Custom-Llm-Key')).toBe('k-1')
    expect(headers.get('X-Custom-Llm-Model')).toBe('gpt-test')
  })

  it('maps API response errors using i18n, triggers onError/onUnauthorized, and respects silentErrors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    const onUnauthorized = vi.fn()
    const { request, configureApi } = await import('./api.service')
    configureApi({ onError, onUnauthorized })

    // errors.api.<code>
    transportMocks.rawFetch.mockResolvedValueOnce(jsonResponse({ code: 'RATE_LIMIT', details: { retry: 10 } }, 429))
    await expect(request('/api/books')).rejects.toMatchObject({
      message: 'Rate limit exceeded',
      code: 'RATE_LIMIT',
      status: 429,
      details: { retry: 10 },
    })
    expect(onError).toHaveBeenCalledWith('Rate limit exceeded')
    expect(transportMocks.recordApiError).toHaveBeenCalled()

    // errors.<code>
    transportMocks.rawFetch.mockResolvedValueOnce(jsonResponse({ code: 'CUSTOM_CODE' }, 400))
    await expect(request('/api/books')).rejects.toThrow('Custom code error')

    // 500 normal vs 500 withLlm
    transportMocks.rawFetch.mockResolvedValueOnce(jsonResponse({ error: 'Boom' }, 500))
    await expect(request('/api/books')).rejects.toThrow('Internal server error')

    transportMocks.rawFetch.mockResolvedValueOnce(jsonResponse({ error: 'Boom' }, 500))
    await expect(request('/api/books', { withLlm: true })).rejects.toThrow('AI server error')

    // 401 on regular endpoint invokes onUnauthorized
    transportMocks.rawFetch.mockResolvedValueOnce(jsonResponse({ message: 'No auth' }, 401))
    await expect(request('/api/books')).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)

    // 401 on auth login endpoint does NOT invoke onUnauthorized
    transportMocks.rawFetch.mockResolvedValueOnce(jsonResponse({ message: 'Bad creds' }, 401))
    await expect(request('/api/auth/login')).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)

    // silentErrors suppresses onError and onUnauthorized
    onError.mockClear()
    transportMocks.rawFetch.mockResolvedValueOnce(jsonResponse({ message: 'Silent' }, 401))
    await expect(request('/api/books', { silentErrors: true })).rejects.toMatchObject({ status: 401 })
    expect(onError).not.toHaveBeenCalled()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)

    errorSpy.mockRestore()
  })

  it('classifies network, timeout, abort, and unauthorized request errors in onRequestError', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()
    const onUnauthorized = vi.fn()
    const { request, configureApi } = await import('./api.service')
    configureApi({ onError, onUnauthorized })

    // Network TypeError
    transportMocks.rawFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(request('/api/books', { retry: 0 })).rejects.toThrow('Network error')
    expect(onError).not.toHaveBeenCalled()

    // Timeout
    transportMocks.rawFetch.mockRejectedValueOnce(new Error('Request timed out'))
    await expect(request('/api/books', { retry: 0, timeout: 5000 })).rejects.toMatchObject({
      name: 'TimeoutError',
      message: 'Request exceeded the 5000 ms client timeout',
    })

    // Abort
    const abortErr = new DOMException('The user aborted a request', 'AbortError')
    transportMocks.rawFetch.mockRejectedValueOnce(abortErr)
    await expect(request('/api/books', { retry: 0 })).rejects.toMatchObject({ name: 'AbortError' })

    // Unexpected error with status 403 triggers both onError and onUnauthorized
    const authFail = Object.assign(new Error('Refresh rejected'), { status: 403 })
    transportMocks.rawFetch.mockRejectedValueOnce(authFail)
    await expect(request('/api/books', { retry: 0 })).rejects.toMatchObject({ status: 403 })
    expect(onError).toHaveBeenCalledWith('Refresh rejected')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)

    errorSpy.mockRestore()
  })

  it('falls back from session login/register to legacy endpoints only on 404', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { api } = await import('./api.service')

    // 404 fallback on login
    transportMocks.rawFetch
      .mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, 404))
      .mockResolvedValueOnce(jsonResponse({ token: 'legacy', user: { id: 1 } }))

    await expect(api.auth.login({ login: 'u', password: 'p' })).resolves.toEqual({ token: 'legacy', user: { id: 1 } })
    expect(String(transportMocks.rawFetch.mock.calls[0][0])).toContain('/api/auth/session/login')
    expect(String(transportMocks.rawFetch.mock.calls[1][0])).toContain('/api/auth/login')

    // Non-404 on register does not fallback
    transportMocks.rawFetch.mockResolvedValueOnce(jsonResponse({ message: 'Conflict' }, 409))
    await expect(api.auth.register({ email: 'a@b.test', code: '1', username: 'u', password: 'p' }))
      .rejects
      .toMatchObject({ status: 409 })

    errorSpy.mockRestore()
  })

  it('fetches image blobs without Authorization via browser fetch or Tauri fetch', async () => {
    const { api } = await import('./api.service')
    const browserFetch = vi.fn().mockResolvedValueOnce(new Response('img-bytes', { status: 200 }))
    vi.stubGlobal('fetch', browserFetch)

    const blob = await api.books.fetchImageBlob('/api/uploads/1.png')
    expect(browserFetch).toHaveBeenCalledWith('https://cdn.example.test/api/uploads/1.png', undefined)
    expect(await blob.text()).toBe('img-bytes')

    const controller = new AbortController()
    browserFetch.mockResolvedValueOnce(new Response(null, { status: 404, statusText: 'Not Found' }))
    await expect(api.books.fetchImageBlob('/api/uploads/missing.png', { signal: controller.signal })).rejects.toThrow('Failed to fetch image: Not Found')
    expect(browserFetch).toHaveBeenLastCalledWith('https://cdn.example.test/api/uploads/missing.png', { signal: controller.signal })

    transportMocks.isTauri = true
    transportMocks.tauriFetch.mockResolvedValueOnce(new Response('tauri-img', { status: 200 }))
    const tauriBlob = await api.books.fetchImageBlob('/api/uploads/2.png')
    expect(transportMocks.tauriFetch).toHaveBeenCalledWith('https://cdn.example.test/api/uploads/2.png', undefined)
    expect(await tauriBlob.text()).toBe('tauri-img')
  })

  it('builds URLs, methods, query params, and FormData across all API domains', async () => {
    const { api } = await import('./api.service')
    transportMocks.rawFetch.mockImplementation(async () => jsonResponse({ success: true }))

    const file = new File(['data'], 'sample.bin')
    const blob = new Blob(['audio'])
    const fd = new FormData()

    await api.auth.sendCode({ email: 'a@b.test' })
    await api.auth.me()
    await api.auth.oauthStatus('sess/1')
    await api.auth.updateAvatar(file)
    await api.auth.updateUsername('alice')
    await api.auth.unlinkProvider('yandex')
    api.auth.discardSession({})

    await api.books.list()
    await api.books.getPublic('page=1')
    await api.books.getInfo(1)
    await api.books.getAllCacheAll(1)
    await api.books.startReading(1)
    await api.books.updateInfo(1, { title: 'T' })
    await api.books.analyzeBook(1)
    await api.books.analyzeVocabulary(1)
    await api.books.updateCover(1, file)
    await api.books.updateStats(1, { totalWords: 10 })
    await api.books.upload(file)
    await api.books.createCustomBook({ title: 'M', language: 'ja', type: 'manga' })
    await api.books.appendMangaChapter(1, fd)
    await api.books.delete(1)
    await api.books.getToc(1)
    await api.books.getPage(1, 2, true)
    await api.books.getPageDict(1, 2)
    await api.books.lookupWord(
      1,
      'hello',
      undefined,
      'en',
    )
    await api.books.lookupWord(0, 'hello')
    await api.books.checkCache(1, [{ text: 'hi', type: 'word' }], 'en')
    await api.books.analyzeBatch(1, [{ id: '1', sentence: 'hi' }], 'en')
    await api.books.analyze(0, 'hi', 'en')
    await api.books.generateTts(
      1,
      'hi',
      'Kore',
      undefined,
      true,
    )

    await api.tts.generate('hi', 'Kore')
    await api.tts.transcribe(blob, 'en')

    await api.dictionary.openBookDeck(1, true)
    await api.dictionary.generateBookDeckWord('d1', 'word', true)
    await api.dictionary.saveBookDeck(
      'd1',
      'Deck',
      ['word'],
      false,
    )
    await api.dictionary.page({ limit: 20 })
    await api.dictionary.list()
    await api.dictionary.decks()
    await api.dictionary.createDeck({ name: 'D', language: 'en' })
    await api.dictionary.updateDeck(1, { name: 'D2' })
    await api.dictionary.deleteDeck(1, 'delete_all')
    await api.dictionary.get('gift', 'en')
    await api.dictionary.upsert({ word: 'gift' })
    await api.dictionary.remove('gift', 'en')
    await api.dictionary.getReviewQueue({ lang: 'en', mode: 'srs', deckId: [1, 2], difficulty: 'B1' })
    await api.dictionary.getReviewQueue({ lang: 'en', mode: 'random', deckId: 3, difficulty: 'all' })
    await api.dictionary.submitReview(1, 3)
    await api.dictionary.bulkDelete([1, 2])
    await api.dictionary.bulkMove([1], [2])
    await api.dictionary.generateExamples('gift', 'en')
    await api.dictionary.autoFillWord('gift', 'en')
    await api.dictionary.generateDeepDive('gift', 'en', 'collocations')
    await api.dictionary.checkPronunciation('gift', 'en', blob)
    await api.dictionary.importCsv([])
    await api.dictionary.catalog()
    await api.dictionary.catalogWords(1)
    await api.dictionary.cloneCatalog(1)
    await api.dictionary.promptsList()
    await api.dictionary.promptsCreate({ name: 'N', prompt: 'P' })
    await api.dictionary.promptsUpdate(1, { name: 'N2' })
    await api.dictionary.promptsDelete(1)
    await api.dictionary.chat({ word: 'gift', language: 'en' })

    await api.activity.getStats()
    await api.activity.getTokens('7d')
    await api.activity.getTokens()

    await api.quiz.getLevels('en')
    await api.quiz.generate('en', 'B1')
    await api.quiz.submit('en', 'B1', 80)

    await api.llm.generate({ prompt: 'hi' })

    await api.highlights.list(1)
    await api.highlights.list()
    await api.highlights.create({ bookId: 1, text: 't', pageNum: 1 })
    await api.highlights.update(1, { note: 'n' })
    await api.highlights.delete(1)

    await api.plugins.getMyPlugins()
    await api.plugins.installPlugin({ pluginId: 'p1', manifestUrl: 'https://m' })
    await api.plugins.updatePlugin('p1', { isEnabled: false })
    await api.plugins.uninstallPlugin('p1')

    await api.catalogPlugins.getApproved()
    await api.catalogPlugins.getMy()
    await api.catalogPlugins.getPending()
    await api.catalogPlugins.upload(file, 'p1')
    await api.catalogPlugins.updateStatus('p1', '1.0.0', 'approved')
    await api.catalogPlugins.delete('p1')
    await api.catalogPlugins.deleteVersion('p1', '1.0.0')

    await api.subscriptions.getTiers('ru')

    await api.push.subscribe({ endpoint: 'https://p' } as PushSubscription)
    await api.push.unsubscribe('https://p')
    await api.push.getVapidPublicKey()
    await api.push.updateSettings({
      targetDeckId: 'all',
      timeStart: '09:00',
      timeEnd: '21:00',
      timezone: 'UTC',
      uiLanguage: 'ru',
      pushCount: 2,
    })

    const calledUrls = transportMocks.rawFetch.mock.calls.map(([u]) => String(u))
    expect(calledUrls.some(u => u.includes('/api/books/1/page/2?sync=true'))).toBe(true)
    expect(calledUrls.some(u => u.includes('/api/dictionary/review') && u.includes('mode=srs') && u.includes('difficulty=B1'))).toBe(true)
    expect(calledUrls.some(u => u.includes('/api/dictionary/review') && u.includes('mode=random') && u.includes('deckId=3'))).toBe(true)
    expect(calledUrls.some(u => u.includes('/api/llm/analyze'))).toBe(true)
    expect(calledUrls.some(u => u.includes('/api/catalog/plugins/p1/versions/1.0.0/status'))).toBe(true)
    expect(calledUrls.some(u => u.includes('/api/push/settings'))).toBe(true)
  })
})
