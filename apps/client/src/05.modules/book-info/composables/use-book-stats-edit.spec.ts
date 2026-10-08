import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useBookStatsEdit } from './use-book-stats-edit'

const { library, toast } = vi.hoisted(() => ({
  library: {
    currentBookInfo: {
      id: 1,
      language: 'en',
      stats: { difficulty: 'B2', tags: ['adventure'], description: '{"ru":"Описание","en":"Description","zh":"简介"}' },
    },
    updateBookStats: vi.fn(),
    analyzeFullBook: vi.fn(),
    analyzeVocabulary: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('~/05.modules/library/store/library.store', () => ({ useLibraryStore: () => library }))
vi.mock('~/01.shared/store/settings.store', () => ({ useGlobalSettingsStore: () => ({ appLanguage: 'ru' }) }))
vi.mock('~/01.shared/composables/use-toast', () => ({ useToast: () => toast }))
vi.mock('~/00.plugins/i18n', () => ({ i18n: { global: { t: (key: string) => key } } }))

let scope = effectScope()

async function openEditor() {
  const visible = ref(false)
  const editor = scope.run(() => useBookStatsEdit(visible))!
  visible.value = true
  await nextTick()

  return { visible, editor }
}

beforeEach(() => {
  vi.clearAllMocks()
  scope = effectScope()
})
afterEach(() => scope.stop())

describe('book stats draft', () => {
  it('saves the edited language and preserves the other descriptions', async () => {
    const { editor, visible } = await openEditor()
    expect(editor.isDirty.value).toBe(false)
    editor.editForm.descriptionByLang.ru = 'Новое описание'
    expect(editor.isDirty.value).toBe(true)
    await editor.saveStats()
    const saved = library.updateBookStats.mock.calls[0][1]
    expect(JSON.parse(saved.description)).toEqual({ ru: 'Новое описание', en: 'Description', zh: '简介' })
    expect(visible.value).toBe(false)
  })

  it('keeps a failed save open with its draft intact and allows retry', async () => {
    const { editor, visible } = await openEditor()
    editor.editForm.descriptionByLang.ru = 'Черновик'
    library.updateBookStats.mockRejectedValueOnce(new Error('Save failed'))
    await editor.saveStats()
    expect(visible.value).toBe(true)
    expect(editor.editForm.descriptionByLang.ru).toBe('Черновик')
    expect(editor.isSaving.value).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('Save failed')
    await editor.saveStats()
    expect(visible.value).toBe(false)
  })

  it('prevents duplicate saves while the first request is pending', async () => {
    const { editor } = await openEditor()
    let finish: (() => void) | undefined
    library.updateBookStats.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finish = resolve
    }))
    const pending = editor.saveStats()
    expect(editor.isSaving.value).toBe(true)
    await editor.saveStats()
    expect(library.updateBookStats).toHaveBeenCalledTimes(1)
    finish?.()
    await pending
    expect(editor.isSaving.value).toBe(false)
  })
})
