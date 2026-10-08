import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import BookLexicalWords from './book-lexical-words.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

it('selects the word without reaching the document popover close handler', async () => {
  const closePopover = vi.fn()
  const word = { word: 'thing', pos: 'n', count: 169 }
  const wrapper = mount(BookLexicalWords, { props: { words: [word] }, attachTo: document.body })
  document.addEventListener('click', closePopover)

  try {
    const button = wrapper.get('button')
    await button.trigger('click')

    expect(wrapper.emitted('select')?.[0]?.[0]).toEqual(word)
    expect((wrapper.emitted('select')?.[0]?.[1] as MouseEvent).target).toBe(button.element)
    expect(closePopover).not.toHaveBeenCalled()
  }
  finally {
    document.removeEventListener('click', closePopover)
    wrapper.unmount()
  }
})
