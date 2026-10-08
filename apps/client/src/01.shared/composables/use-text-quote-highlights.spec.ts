import type { QuoteHighlightSource } from '../lib/dom-highlighter'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, useTemplateRef } from 'vue'
import { useTextQuoteHighlights } from './use-text-quote-highlights'

const registry = new Map<string, Set<Range>>()

function renderText() {
  const text = ref('As far as I could tell, anyone who was indoors died instantly.')
  const quotes = ref<QuoteHighlightSource[]>([
    { text: 'As far as', color: '#fde047' },
    { text: 'died instantly', color: '#86efac' },
  ])
  const visible = ref(true)
  const wrapper = mount(defineComponent({
    setup() {
      const root = useTemplateRef<HTMLElement>('root')
      useTextQuoteHighlights(root, quotes, text)

      return () => visible.value ? h('div', { ref: 'root' }, text.value) : null
    },
  }))

  return { wrapper, text, quotes, visible }
}

function highlightedText() {
  return [...registry.values()].flatMap(ranges => [...ranges].map(range => range.toString()))
}

describe('text quote highlights', () => {
  beforeEach(() => {
    vi.stubGlobal('Highlight', class extends Set<Range> {
      constructor(...ranges: Range[]) {
        super(ranges)
      }
    })
    vi.stubGlobal('CSS', { highlights: registry })
  })

  afterEach(() => {
    registry.clear()
    vi.unstubAllGlobals()
  })

  it('highlights multiple fragments in their colors without changing text markup', async () => {
    const { wrapper, text } = renderText()
    await nextTick()
    await nextTick()

    expect(highlightedText()).toEqual(['As far as', 'died instantly'])
    expect(registry.size).toBe(2)
    expect(wrapper.element.innerHTML).toBe(text.value)
    wrapper.unmount()
    expect(registry.size).toBe(0)
  })

  it('updates when quotes are removed and the sentence changes', async () => {
    const { wrapper, quotes, text } = renderText()
    await nextTick()
    await nextTick()

    quotes.value.splice(0, 1)
    await nextTick()
    await nextTick()
    expect(highlightedText()).toEqual(['died instantly'])

    text.value = 'A different sentence.'
    await nextTick()
    await nextTick()
    expect(registry.size).toBe(0)
    wrapper.unmount()
  })

  it('clears hidden content and preserves other mounted views', async () => {
    const first = renderText()
    const second = renderText()
    await nextTick()
    await nextTick()
    expect(highlightedText()).toHaveLength(4)

    first.visible.value = false
    await nextTick()
    await nextTick()
    expect(highlightedText()).toHaveLength(2)
    first.wrapper.unmount()
    expect(highlightedText()).toHaveLength(2)
    second.wrapper.unmount()
    expect(registry.size).toBe(0)
  })
})
