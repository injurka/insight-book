import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearQuoteHighlights, collectQuoteRanges, findQuoteRange, setQuoteHighlights } from './dom-highlighter'

let registry: Map<string, Set<Range>>
beforeEach(() => {
  registry = new Map()
  vi.stubGlobal('CSS', { highlights: registry })
  vi.stubGlobal('Highlight', class extends Set<Range> {
    constructor(...ranges: Range[]) { super(ranges) }
  })
})
afterEach(() => {
  for (const owner of ['a', 'b'])
    clearQuoteHighlights(owner)

  vi.unstubAllGlobals()
  document.head.querySelector('#saved-quote-highlight-styles')?.remove()
})

function root(html = '<span class="sentence" data-raw-sent="Hello%20world">Hello <b>world</b></span>') {
  const element = document.createElement('div')
  element.innerHTML = html

  return element
}

function range(text = 'hello') {
  return findQuoteRange(root(`<span>${text}</span>`), text)!
}

describe('quote ranges', () => {
  it('matches across nodes without changing the DOM and prefers exact matches', () => {
    const element = root('<i>Hello </i><b>world</b> HELLO world')
    const html = element.innerHTML
    expect(findQuoteRange(element, 'Hello world')?.toString()).toBe('Hello world')
    expect(findQuoteRange(element, 'HELLO world')?.toString()).toBe('HELLO world')
    expect(element.innerHTML).toBe(html)
  })
  it('keeps original offsets when Unicode lowercase expands characters', () => {
    expect(findQuoteRange(root('<span>İ hello WORLD</span>'), 'world')?.toString()).toBe('WORLD')
    expect(findQuoteRange(root('<span>İ hello WORLD</span>'), 'i\u0307')?.toString()).toBe('İ')
    expect(findQuoteRange(root('<span>İ hello WORLD</span>'), 'i')?.toString()).toBe('İ')
    expect(findQuoteRange(root('<span>😀 İ hello WORLD</span>'), 'world')?.toString()).toBe('WORLD')
  })
  it('returns null for empty and absent text', () => {
    expect(findQuoteRange(root(), '')).toBeNull()
    expect(findQuoteRange(root(), 'missing')).toBeNull()
    expect(findQuoteRange(root(''), 'hello')).toBeNull()
  })
  it('groups partial quotes, ignores unmatched quotes and uses the default color', () => {
    const ranges = collectQuoteRanges(root(), [{ text: 'Hello' }, { text: 'world', color: 'pink' }, { text: '' }, { text: 'missing' }])
    expect(ranges.get('#fde047')?.[0].toString()).toBe('Hello')
    expect(ranges.get('pink')?.[0].toString()).toBe('world')
    expect(ranges.size).toBe(2)
    expect(collectQuoteRanges(root(), []).size).toBe(0)
  })
  it('does not invent ranges from normalized text or malformed sentence metadata', () => {
    expect(collectQuoteRanges(root(), [{ text: 'Hello   world' }]).size).toBe(0)
    expect(collectQuoteRanges(root('<span class="sentence" data-raw-sent="%ZZ">Hi</span>'), [{ text: 'Hello' }]).size).toBe(0)
  })
})

describe('highlight ownership', () => {
  it('merges ranges for equivalent named and hex colors across owners', () => {
    const first = range()
    const second = range('world')
    setQuoteHighlights('a', new Map([['yellow', [first]]]))
    setQuoteHighlights('b', new Map([['#fde047', [second]]]))
    expect(registry.size).toBe(1)
    expect(Array.from([...registry.values()][0])).toEqual([first, second])
    clearQuoteHighlights('a')
    expect(Array.from([...registry.values()][0])).toEqual([second])
    clearQuoteHighlights('b')
    expect(registry.size).toBe(0)
    expect(document.getElementById('saved-quote-highlight-styles')).toBeNull()
  })
  it('does not collide RGB colors or delete other registry entries', () => {
    const foreign = new Set<Range>()
    registry.set('external', foreign)
    setQuoteHighlights('a', new Map([['#011702', [range()]], ['#0c0302', [range('world')]]]))
    expect(registry.size).toBe(3)
    setQuoteHighlights('a', new Map())
    expect(registry).toEqual(new Map([['external', foreign]]))
  })
  it('updates an owner and removes stale color styles', () => {
    setQuoteHighlights('a', new Map([['pink', [range()]]]))
    setQuoteHighlights('a', new Map([['blue', [range('world')]]]))
    expect(registry.size).toBe(1)
    expect(document.getElementById('saved-quote-highlight-styles')?.textContent).toContain('147, 197, 253')
    clearQuoteHighlights('missing')
    expect(registry.size).toBe(1)
  })
  it('gracefully handles browsers without the Highlight API', () => {
    vi.stubGlobal('Highlight', undefined)
    expect(() => setQuoteHighlights('a', new Map([['yellow', [range()]]]))).not.toThrow()
    clearQuoteHighlights('a')
    expect(registry.size).toBe(0)
  })
})
