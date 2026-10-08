import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import { useReaderDomHighlights } from './use-reader-dom-highlights'

const { useAnalysisStore } = vi.hoisted(() => ({ useAnalysisStore: vi.fn() }))
vi.mock('~/01.shared/store/analysis/analysis.store', () => ({ useAnalysisStore }))

describe('reader token highlighting', () => {
  it('activates and clears all HTML fragments of a word', async () => {
    const store = reactive({ activeTokenId: null as string | null })
    useAnalysisStore.mockReturnValue(store)
    const container = document.createElement('div')
    container.innerHTML = '<span class="word" data-sent-id="0" data-token-idx="1">ca</span><em><span class="word" data-sent-id="0" data-token-idx="1">t</span></em><span class="word" data-sent-id="0" data-token-idx="2">sleeps</span>'
    const scope = effectScope()
    scope.run(() => useReaderDomHighlights(ref(container)))
    store.activeTokenId = '0-1'
    await nextTick()
    expect(container.querySelectorAll('.is-active')).toHaveLength(2)
    store.activeTokenId = '0-2'
    await nextTick()
    expect(container.querySelectorAll('.is-active')).toHaveLength(1)
    expect(container.querySelector('.is-active')?.textContent).toBe('sleeps')
    store.activeTokenId = null
    await nextTick()
    expect(container.querySelectorAll('.is-active')).toHaveLength(0)
    scope.stop()
  })
})

describe('continuous reader page boundaries', () => {
  it('does not highlight matching sentence IDs on adjacent pages and updates for the same token ID', async () => {
    const container = document.createElement('div')
    container.innerHTML = '<div class="reader-content"><span class="sentence" data-sent-id="0"><span class="word" data-sent-id="0" data-token-idx="0">first</span></span></div><div class="reader-content"><span class="sentence" data-sent-id="0"><span class="word" data-sent-id="0" data-token-idx="0">second</span></span></div>'
    const words = container.querySelectorAll<HTMLElement>('.word')
    const store = reactive({ activeTokenId: null as string | null, wordPopover: null as { target: HTMLElement } | null })
    useAnalysisStore.mockReturnValue(store)
    const scope = effectScope()
    const handlers = scope.run(() => useReaderDomHighlights(ref(container)))!
    store.activeTokenId = '0-0'
    store.wordPopover = { target: words[1] }
    await nextTick()
    expect(words[0].classList.contains('is-active')).toBe(false)
    expect(words[1].classList.contains('is-active')).toBe(true)
    store.wordPopover = { target: words[0] }
    await nextTick()
    expect(words[0].classList.contains('is-active')).toBe(true)
    expect(words[1].classList.contains('is-active')).toBe(false)
    const event = new MouseEvent('mouseover')
    Object.defineProperty(event, 'target', { value: words[1] })
    handlers.onSentenceHover(event)
    expect(container.querySelectorAll('.is-hovered')).toHaveLength(1)
    expect(container.querySelector('.is-hovered')?.textContent).toBe('second')
    handlers.onSentenceOut(event)
    expect(container.querySelectorAll('.is-hovered')).toHaveLength(0)
    scope.stop()
  })
})
