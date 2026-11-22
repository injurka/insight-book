import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import UploadBookModal from './upload-book-modal.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

const { toastSuccess, toastError, checkAuthMock } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  checkAuthMock: vi.fn(),
}))

vi.mock('~/01.shared/composables/use-toast', () => ({
  useToast: () => ({
    success: toastSuccess,
    error: toastError,
    warn: vi.fn(),
  }),
}))

vi.mock('~/01.shared/store/auth.store', () => ({
  useAuthStore: () => ({
    checkAuth: checkAuthMock,
  }),
}))

vi.mock('~/01.shared/store/network.store', () => ({
  useNetworkStore: () => ({
    effectiveOffline: false,
  }),
}))

const uploadBookMock = vi.fn()
vi.mock('../../store/library.store', () => ({
  useLibraryStore: () => ({
    uploadBook: uploadBookMock,
    createCustomManga: vi.fn(),
    uploadMangaChapter: vi.fn(),
    analyzeVocabulary: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@iconify/vue', () => ({
  Icon: defineComponent({
    name: 'Icon',
    props: ['icon'],
    template: '<span class="icon-mock" />',
  }),
}))

const KitTabsStub = defineComponent({
  name: 'KitTabs',
  template: '<div><slot name="file" /><slot name="images" /></div>',
})

const KitDialogStub = defineComponent({
  name: 'KitDialog',
  props: {
    visible: Boolean,
    title: String,
    minimizable: Boolean,
    maxWidth: Number,
    persistent: Boolean,
    closable: {
      type: Boolean,
      default: true,
    },
    icon: String,
  },
  emits: ['update:visible'],
  template: `
    <div
      v-if="visible"
      class="kit-dialog-stub"
      :data-closable="String(closable)"
      :data-persistent="String(persistent)"
    >
      <button v-if="closable" class="close-button" @click="$emit('update:visible', false)">Close</button>
      <slot />
    </div>
  `,
})

function mountUploadModal() {
  return mount(UploadBookModal, {
    props: {
      visible: true,
    },
    global: {
      stubs: {
        KitDialog: KitDialogStub,
        KitTabs: KitTabsStub,
        KitBtn: true,
        KitInput: true,
        KitSelect: true,
      },
    },
  })
}

describe('upload-book-modal.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    uploadBookMock.mockReset()
    toastSuccess.mockClear()
    toastError.mockClear()
    checkAuthMock.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    { userAgent: 'Mozilla/5.0 (Linux; Android 15) Mobile', hasFilter: false },
    { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', hasFilter: true },
  ])('sets the ready-book file filter for $userAgent', ({ userAgent, hasFilter }) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)

    const wrapper = mountUploadModal()

    const dialog = wrapper.findComponent(KitDialogStub)
    expect(dialog.exists()).toBe(true)
    expect(dialog.props('closable')).toBe(true)
    expect(wrapper.find('.close-button').exists()).toBe(true)
    expect(wrapper.get('input[type="file"]').element.hasAttribute('accept')).toBe(hasFilter)
  })

  it('hides close button and sets closable=false while uploading is in progress', async () => {
    let resolveUpload!: (value: unknown) => void
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve
    })
    uploadBookMock.mockReturnValue(uploadPromise)

    const wrapper = mountUploadModal()

    const fileInput = wrapper.find('input[type="file"]')
    const dummyFile = new File(['test content'], 'book.epub', { type: 'application/epub+zip' })

    Object.defineProperty(fileInput.element, 'files', {
      value: [dummyFile],
      writable: false,
    })

    await fileInput.trigger('change')

    const dialog = wrapper.findComponent(KitDialogStub)
    expect(dialog.props('closable')).toBe(false)
    expect(dialog.props('persistent')).toBe(true)
    expect(wrapper.find('.close-button').exists()).toBe(false)

    // Finish upload
    resolveUpload({ id: 1 })
    await flushPromises()

    expect(dialog.props('closable')).toBe(true)
  })

  it('keeps the file picker open after a rejected upload and accepts a retry', async () => {
    uploadBookMock.mockRejectedValueOnce(new Error('Unreadable file')).mockResolvedValueOnce({ id: 1 })
    const wrapper = mountUploadModal()
    const file = new File(['contents'], 'book.epub')

    for (let attempt = 0; attempt < 2; attempt++) {
      const input = wrapper.get('input[type="file"]')
      Object.defineProperty(input.element, 'files', { value: [file] })
      await input.trigger('change')
      await flushPromises()
    }

    expect(uploadBookMock.mock.calls).toEqual([[file], [file]])
    expect(toastError).toHaveBeenCalledWith('Unreadable file')
    expect(toastSuccess).toHaveBeenCalledWith('library.uploadSuccess')
  })

  it('reports a completed upload even if the account refresh fails', async () => {
    uploadBookMock.mockResolvedValue({ id: 1 })
    checkAuthMock.mockRejectedValueOnce(new Error('Network unavailable'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mountUploadModal()
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['contents'], 'book.epub')] })

    await input.trigger('change')
    await flushPromises()

    expect(toastSuccess).toHaveBeenCalledWith('library.uploadSuccess')
    expect(toastError).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })
})
