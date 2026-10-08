import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { deferred, mountComposable } from './__tests__/helpers'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))
const scanned = ref<string[]>([])
const uploaded = ref<Array<{ name: string, family: string, fileName: string, size: number }>>([])
vi.mock('@vueuse/core', () => ({ useLocalStorage: (key: string) => key.includes('scanned') ? scanned : uploaded }))
vi.mock('localforage', () => ({ default: { getItem: mocks.get, setItem: mocks.set, removeItem: mocks.remove } }))
vi.mock('~/01.shared/composables/use-toast', () => ({ useToast: () => ({ success: mocks.success, error: mocks.error }) }))
const { useCustomFonts } = await import('./use-custom-fonts')

class TestFontFace {
  constructor(public family: string) {}
  load = vi.fn().mockResolvedValue(this)
}
let fonts: Set<TestFontFace>

beforeEach(() => {
  vi.resetAllMocks()
  scanned.value = []
  uploaded.value = []
  fonts = new Set()
  vi.stubGlobal('FontFace', TestFontFace)
  Object.defineProperty(document, 'fonts', { configurable: true, value: fonts })
})
afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(window, 'queryLocalFonts')
  Reflect.deleteProperty(document, 'fonts')
  vi.restoreAllMocks()
})

function fontFile(name: string) {
  const file = new File(['font'], name)
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(4) })

  return file
}

describe('useCustomFonts', () => {
  it('scans unique sorted families and clears the scanning flag', async () => {
    Object.defineProperty(window, 'queryLocalFonts', { configurable: true, value: vi.fn(async () => [{ family: 'Z' }, { family: 'A' }, { family: 'A' }]) })
    const { api, wrapper } = mountComposable(useCustomFonts)
    expect(await api.scanSystemFonts()).toEqual(['A', 'Z'])
    expect(api.scannedSystemFonts.value).toEqual(['A', 'Z'])
    expect(api.isScanning.value).toBe(false)
    wrapper.unmount()
  })

  it('handles unsupported and denied system-font access', async () => {
    const { api, wrapper } = mountComposable(useCustomFonts)
    expect(await api.scanSystemFonts()).toEqual([])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    Object.defineProperty(window, 'queryLocalFonts', {
      configurable: true,
      value: async () => {
        throw new Error('denied')
      },
    })
    expect(await api.scanSystemFonts()).toEqual([])
    expect(mocks.error).toHaveBeenCalledTimes(2)
    expect(api.isScanning.value).toBe(false)
    warn.mockRestore()
    wrapper.unmount()
  })

  it('validates extensions and empty font-family names', async () => {
    const { api, wrapper } = mountComposable(useCustomFonts)
    expect(await api.uploadFontFile(fontFile('a.exe'))).toBeNull()
    expect(await api.uploadFontFile(fontFile(' .ttf'))).toBeNull()
    expect(mocks.set).not.toHaveBeenCalled()
    expect(api.isUploading.value).toBe(false)
    wrapper.unmount()
  })

  it('persists uploads, replaces the existing face and removes it from the browser', async () => {
    const { api, wrapper } = mountComposable(useCustomFonts)
    expect(await api.uploadFontFile(fontFile('Uploaded.WOFF2'))).toBe('Uploaded')
    expect(mocks.set).toHaveBeenCalledWith('user_font_Uploaded', expect.any(ArrayBuffer))
    expect(fonts.size).toBe(1)
    expect(await api.uploadFontFile(fontFile('Uploaded.ttf'))).toBe('Uploaded')
    expect(fonts.size).toBe(1)
    expect(api.uploadedFonts.value).toHaveLength(1)
    expect(api.uploadedFonts.value[0].fileName).toBe('Uploaded.ttf')
    await api.removeUploadedFont('Uploaded')
    expect(fonts.size).toBe(0)
    expect(api.uploadedFonts.value).toEqual([])
    wrapper.unmount()
  })

  it('does not register or publish an upload when persistence fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.set.mockRejectedValueOnce(new Error('quota'))
    const { api, wrapper } = mountComposable(useCustomFonts)
    expect(await api.uploadFontFile(fontFile('Failed.ttf'))).toBeNull()
    expect(fonts.size).toBe(0)
    expect(api.uploadedFonts.value).toEqual([])
    expect(api.isUploading.value).toBe(false)
    error.mockRestore()
    wrapper.unmount()
  })

  it('deduplicates concurrent restoration and retries failed restoration', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    uploaded.value = [{ name: 'Restored', family: 'Restored', fileName: 'Restored.ttf', size: 4 }]
    mocks.get.mockRejectedValueOnce(new Error('transient'))
    const first = mountComposable(useCustomFonts)
    const second = mountComposable(useCustomFonts)
    await flushPromises()
    expect(mocks.get).toHaveBeenCalledOnce()
    mocks.get.mockResolvedValue(new ArrayBuffer(4))
    await Promise.all([first.api.loadSavedFonts(), second.api.loadSavedFonts()])
    expect(mocks.get).toHaveBeenCalledTimes(2)
    expect(fonts.size).toBe(1)
    await first.api.removeUploadedFont('Restored')
    first.wrapper.unmount()
    second.wrapper.unmount()
  })

  it('does not restore a font removed while its saved buffer is still loading', async () => {
    const buffer = deferred<ArrayBuffer>()
    uploaded.value = [{ name: 'Removed', family: 'Removed', fileName: 'Removed.ttf', size: 4 }]
    mocks.get.mockReturnValueOnce(buffer.promise)
    const { api, wrapper } = mountComposable(useCustomFonts)
    await api.removeUploadedFont('Removed')
    buffer.resolve(new ArrayBuffer(4))
    await flushPromises()
    expect(fonts.size).toBe(0)
    expect(api.uploadedFonts.value).toEqual([])
    wrapper.unmount()
  })

  it('keeps metadata when deletion fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { api, wrapper } = mountComposable(useCustomFonts)
    await api.uploadFontFile(fontFile('Kept.ttf'))
    mocks.remove.mockRejectedValueOnce(new Error('storage'))
    await api.removeUploadedFont('Kept')
    expect(api.uploadedFonts.value).toHaveLength(1)
    expect(fonts.size).toBe(1)
    expect(mocks.error).toHaveBeenCalled()
    await api.removeUploadedFont('Kept')
    wrapper.unmount()
  })

  it('skips missing saved buffers and already registered fonts', async () => {
    const { api, wrapper } = mountComposable(useCustomFonts)
    await api.uploadFontFile(fontFile('Cached.ttf'))
    await api.loadSavedFonts()
    expect(mocks.get).not.toHaveBeenCalled()
    uploaded.value.push({ name: 'Missing', family: 'Missing', fileName: 'Missing.ttf', size: 4 })
    mocks.get.mockResolvedValue(null)
    await api.loadSavedFonts()
    expect(mocks.get).toHaveBeenCalledWith('user_font_Missing')
    expect(fonts.size).toBe(1)
    await api.removeUploadedFont('Cached')
    wrapper.unmount()
  })

  it('does not start a second scan or upload while an operation is pending', async () => {
    const scan = deferred<Array<{ family: string }>>()
    Object.defineProperty(window, 'queryLocalFonts', { configurable: true, value: () => scan.promise })
    const { api, wrapper } = mountComposable(useCustomFonts)
    const firstScan = api.scanSystemFonts()
    expect(api.isScanning.value).toBe(true)
    expect(await api.scanSystemFonts()).toEqual([])
    scan.resolve([])
    await firstScan
    const stored = deferred<void>()
    mocks.set.mockReturnValueOnce(stored.promise)
    const firstUpload = api.uploadFontFile(fontFile('Busy.ttf'))
    await flushPromises()
    expect(api.isUploading.value).toBe(true)
    expect(await api.uploadFontFile(fontFile('Skipped.ttf'))).toBeNull()
    stored.resolve()
    expect(await firstUpload).toBe('Busy')
    await api.removeUploadedFont('Busy')
    wrapper.unmount()
  })
})
