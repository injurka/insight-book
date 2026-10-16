import type { Book } from '~/01.shared/types/models'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import EditBookModal from './edit-book-modal.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@iconify/vue', () => ({
  Icon: defineComponent({
    name: 'Icon',
    props: ['icon'],
    template: '<span class="icon-mock" />',
  }),
}))

vi.mock('~/01.shared/store/auth.store', () => ({
  useAuthStore: () => ({ isSingleMode: false, user: { id: 1 } }),
}))

vi.mock('~/01.shared/store/network.store', () => ({
  useNetworkStore: () => ({ effectiveOffline: false }),
}))

vi.mock('~/01.shared/composables/use-toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}))

const updateBookInfoMock = vi.fn()
const fetchBooksMock = vi.fn()

vi.mock('../../store/library.store', () => ({
  useLibraryStore: () => ({
    updateBookInfo: updateBookInfoMock,
    fetchBooks: fetchBooksMock,
  }),
}))

const KitBtnStub = defineComponent({
  name: 'KitBtn',
  inheritAttrs: false,
  props: {
    appendIcon: String,
    color: String,
    density: String,
    disabled: Boolean,
    icon: String,
    loading: Boolean,
    prependIcon: String,
    ripple: Boolean,
    size: String,
    type: String,
    variant: String,
  },
  emits: ['click'],
  template: '<button class="kit-btn-stub" :disabled="disabled || loading" @click="$emit(\'click\', $event)"><slot /></button>',
})

const KitDialogStub = defineComponent({
  name: 'KitDialog',
  props: {
    icon: String,
    maxWidth: Number,
    title: String,
    visible: Boolean,
  },
  emits: ['update:visible'],
  template: '<div class="kit-dialog-stub"><slot /><slot name="footer" /></div>',
})

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 42,
    title: 'Test book',
    author: 'Author',
    coverUrl: null,
    filePath: '',
    language: 'en',
    totalPages: 1,
    currentPage: 1,
    createdAt: '2026-01-01 00:00:00',
    publicStatus: 'private',
    isPublic: false,
    isFavorite: false,
    status: 'reading',
    ...overrides,
  } as Book
}

function mountModal(book: Book) {
  return mount(EditBookModal, {
    props: { visible: true, book },
    global: {
      stubs: {
        KitCheckbox: true,
        KitDialog: KitDialogStub,
        KitImage: true,
        KitInput: true,
        KitPrompt: true,
        KitSelect: true,
        KitBtn: KitBtnStub,
      },
    },
  })
}

function publishButton(wrapper: ReturnType<typeof mountModal>) {
  return wrapper.find('.publish-action .kit-btn-stub')
}

function saveButton(wrapper: ReturnType<typeof mountModal>) {
  return wrapper.findAll('.kit-btn-stub').find(btn => btn.text().includes('dictionary.save'))
}

describe('edit-book-modal publish request', () => {
  beforeEach(() => {
    updateBookInfoMock.mockReset().mockResolvedValue({ success: true })
    fetchBooksMock.mockReset().mockResolvedValue(undefined)
  })

  it('sends the publish request immediately, without requiring the save button', async () => {
    const wrapper = mountModal(makeBook())

    await publishButton(wrapper).trigger('click')
    await flushPromises()

    expect(updateBookInfoMock).toHaveBeenCalledWith(42, { publicStatus: 'pending' })
    expect(wrapper.emitted('save')).toBeFalsy()
    expect(wrapper.find('.status-pill').text()).toContain('library.publicStatusPending')
  })

  it('rolls the status back when the publish request fails', async () => {
    updateBookInfoMock.mockRejectedValueOnce(new Error('Cannot edit public book'))

    const wrapper = mountModal(makeBook())

    await publishButton(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.find('.status-pill').text()).toContain('library.publicStatusPrivate')
    expect(fetchBooksMock).toHaveBeenCalled()
  })

  it('cancels a pending request straight from the block', async () => {
    const wrapper = mountModal(makeBook({ publicStatus: 'pending' }))

    await publishButton(wrapper).trigger('click')
    await flushPromises()

    expect(updateBookInfoMock).toHaveBeenCalledWith(42, { publicStatus: 'private' })
    expect(wrapper.find('.status-pill').text()).toContain('library.publicStatusPrivate')
  })

  it('still keeps publicStatus in the save payload', async () => {
    const wrapper = mountModal(makeBook())

    await publishButton(wrapper).trigger('click')
    await flushPromises()

    await saveButton(wrapper)!.trigger('click')
    await wrapper.vm.$nextTick()

    const payload = wrapper.emitted('save')

    expect(payload).toBeTruthy()
    expect(payload![0][0]).toMatchObject({ bookData: { id: 42, publicStatus: 'pending' } })
  })
})
