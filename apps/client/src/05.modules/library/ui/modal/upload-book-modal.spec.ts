import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import UploadBookModal from './upload-book-modal.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('~/01.shared/composables/use-toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

vi.mock('~/01.shared/store/auth.store', () => ({
  useAuthStore: () => ({
    checkAuth: vi.fn().mockResolvedValue(undefined),
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

describe('upload-book-modal.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    uploadBookMock.mockReset()
  })

  it('renders with closable=true when not uploading', () => {
    const wrapper = mount(UploadBookModal, {
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

    const dialog = wrapper.findComponent(KitDialogStub)
    expect(dialog.exists()).toBe(true)
    expect(dialog.props('closable')).toBe(true)
    expect(wrapper.find('.close-button').exists()).toBe(true)
  })

  it('hides close button and sets closable=false while uploading is in progress', async () => {
    let resolveUpload!: (value: unknown) => void
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve
    })
    uploadBookMock.mockReturnValue(uploadPromise)

    const wrapper = mount(UploadBookModal, {
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
})
