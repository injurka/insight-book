import { describe, expect, it } from 'vitest'
import { collectQuoteRanges, findQuoteRange } from './dom-highlighter'

function buildSentence(sentId: string, words: string[]): HTMLElement {
  const span = document.createElement('span')
  span.className = 'sentence'
  span.setAttribute('data-sent-id', sentId)
  span.setAttribute('data-raw-sent', encodeURIComponent(words.join(' ')))
  words.forEach((word, i) => {
    const wordSpan = document.createElement('span')
    wordSpan.className = 'word'
    wordSpan.textContent = word
    span.appendChild(wordSpan)
    if (i < words.length - 1)
      span.appendChild(document.createTextNode(' '))
  })
  return span
}

function buildRoot(...sentences: HTMLElement[]): HTMLElement {
  const root = document.createElement('div')
  for (const sentence of sentences)
    root.appendChild(sentence)
  return root
}

describe('findQuoteRange', () => {
  it('builds a range over a single-word match without touching the DOM', () => {
    const sentence = buildSentence('s1', ['hello', 'brave', 'world'])
    const htmlBefore = sentence.innerHTML

    const range = findQuoteRange(sentence, 'brave')

    expect(range).not.toBeNull()
    expect(range!.toString()).toBe('brave')
    expect((range!.startContainer.parentElement as HTMLElement).textContent).toBe('brave')
    expect(sentence.innerHTML).toBe(htmlBefore)
  })

  it('builds a range spanning multiple word nodes', () => {
    const sentence = buildSentence('s1', ['hello', 'brave', 'world'])

    const range = findQuoteRange(sentence, 'hello brave')

    expect(range).not.toBeNull()
    expect(range!.toString()).toBe('hello brave')
    expect(range!.startContainer).not.toBe(range!.endContainer)
  })

  it('falls back to a case-insensitive match', () => {
    const sentence = buildSentence('s1', ['hello', 'Brave', 'world'])

    const range = findQuoteRange(sentence, 'brave')

    expect(range).not.toBeNull()
    expect(range!.toString()).toBe('Brave')
  })

  it('returns null when the text is absent', () => {
    const sentence = buildSentence('s1', ['hello', 'world'])

    expect(findQuoteRange(sentence, 'missing')).toBeNull()
    expect(findQuoteRange(sentence, '')).toBeNull()
  })
})

describe('collectQuoteRanges', () => {
  it('collects ranges for quotes matching the sentence and groups them by color', () => {
    const root = buildRoot(buildSentence('s1', ['hello', 'brave', 'world']))

    const rangesByColor = collectQuoteRanges(root, [
      { text: 'hello', color: '#fde047' },
      { text: 'world', color: '#86efac' },
    ])

    expect(rangesByColor.size).toBe(2)
    expect(rangesByColor.get('#fde047')!.map(rangeItem => rangeItem.toString())).toEqual(['hello'])
    expect(rangesByColor.get('#86efac')!.map(rangeItem => rangeItem.toString())).toEqual(['world'])
  })

  it('applies the default color when the quote has none', () => {
    const root = buildRoot(buildSentence('s1', ['hello', 'world']))

    const rangesByColor = collectQuoteRanges(root, [{ text: 'hello' }])

    expect([...rangesByColor.keys()]).toEqual(['#fde047'])
  })

  it('matches quotes against the normalized data-raw-sent of each sentence', () => {
    const root = buildRoot(buildSentence('s1', ['hello', 'world']), buildSentence('s2', ['goodbye', 'world']))

    // normalized quote equals normalized sentence s2, but the raw phrase
    // search inside that sentence fails -> no ranges
    const noRanges = collectQuoteRanges(root, [{ text: 'goodbye   world' }])
    expect(noRanges.size).toBe(0)

    // normalized quote is a substring of sentence s1 -> range is found
    const ranges = collectQuoteRanges(root, [{ text: 'hello' }])
    expect(ranges.get('#fde047')!.map(rangeItem => rangeItem.toString())).toEqual(['hello'])
  })

  it('returns an empty map for empty input', () => {
    const root = buildRoot(buildSentence('s1', ['hello', 'world']))

    expect(collectQuoteRanges(root, []).size).toBe(0)
    expect(collectQuoteRanges(root, [{ text: '' }]).size).toBe(0)
  })
})
