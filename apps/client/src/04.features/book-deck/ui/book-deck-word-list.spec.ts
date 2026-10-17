import type { BookDeckWord } from '~/01.shared/types/schemas/book-deck.schema'
import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import BookDeckWordList from './book-deck-word-list.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

function words(count: number): BookDeckWord[] {
  return Array.from({ length: count }, (_, index) => ({
    word: `word-${index}`,
    count: 1,
    forms: [],
    properName: false,
    contexts: [],
    source: 'missing',
    content: null,
  }))
}
function mountList(page = 0) {
  return shallowMount(BookDeckWordList, {
    props: {
      words: words(101),
      selected: new Set<string>(),
      busy: false,
      errors: {},
      page,
    },
  })
}

describe('book deck word browser', () => {
  it('selects only the current page and keeps hidden words untouched', async () => {
    const wrapper = mountList(1)
    wrapper.findComponent({ name: 'KitCheckbox' }).vm.$emit('update:modelValue', true)
    expect(wrapper.emitted('select')).toHaveLength(50)
    expect(wrapper.emitted('select')?.[0]).toEqual(['word-50', true])
    expect(wrapper.emitted('select')?.[49]).toEqual(['word-99', true])
  })

  it('returns to an existing page when filtering or deselection shrinks the list', async () => {
    const wrapper = mountList(2)
    await wrapper.setProps({ words: words(10) })
    expect(wrapper.emitted('update:page')?.at(-1)).toEqual([0])
    await wrapper.setProps({ page: 0 })
    expect(wrapper.findAllComponents({ name: 'BookDeckWordRow' })).toHaveLength(10)
    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('blocks bulk selection while generation is running', () => {
    const wrapper = shallowMount(BookDeckWordList, {
      props: {
        words: words(5),
        selected: new Set<string>(),
        busy: true,
        errors: {},
        page: 0,
      },
    })
    wrapper.findComponent({ name: 'KitCheckbox' }).vm.$emit('update:modelValue', true)
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('forwards offline state to generation controls and hides page selection during review', () => {
    const wrapper = shallowMount(BookDeckWordList, {
      props: {
        words: words(1),
        selected: new Set(['word-0']),
        busy: false,
        errors: {},
        page: 0,
        showGenerate: true,
        offline: true,
      },
    })
    expect(wrapper.findComponent({ name: 'KitCheckbox' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'BookDeckWordRow' }).props('offline')).toBe(true)
  })
})
