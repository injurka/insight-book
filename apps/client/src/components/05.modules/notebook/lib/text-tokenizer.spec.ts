import { describe, expect, it } from 'vitest'
import {
  escapeHtml,
  escapeRegExp,
  highlightTextQuery,
  normalizeString,
} from './text-tokenizer'

describe('escapeHtml', () => {
  it('escapes less-than and greater-than signs', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;')
  })

  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes double quotes', () => {
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
  })

  it('escapes single quotes', () => {
    expect(escapeHtml('it\'s')).toBe('it&#039;s')
  })

  it('escapes all special characters together', () => {
    expect(escapeHtml('<a href="x">&\'')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#039;')
  })

  it('escapes ampersand before other entities to avoid double escaping', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })

  it('returns plain text unchanged', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123')
  })

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('escapes multiple occurrences of the same character', () => {
    expect(escapeHtml('<<>>')).toBe('&lt;&lt;&gt;&gt;')
  })
})

describe('escapeRegExp', () => {
  it('escapes all regex special characters', () => {
    expect(escapeRegExp('.*+?^${}()|[]\\')).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')
  })

  it('leaves plain text unchanged', () => {
    expect(escapeRegExp('hello')).toBe('hello')
  })

  it('makes escaped string safe for RegExp constructor', () => {
    const query = '1+1=2'
    const re = new RegExp(escapeRegExp(query))
    expect(re.test(query)).toBe(true)
    expect(re.test('111=2')).toBe(false)
  })

  it('returns empty string for empty input', () => {
    expect(escapeRegExp('')).toBe('')
  })
})

describe('highlightTextQuery', () => {
  it('wraps exact match in mark tag with text-match class', () => {
    expect(highlightTextQuery('hello world', 'world')).toBe('hello <mark class="text-match">world</mark>')
  })

  it('matches case-insensitively', () => {
    expect(highlightTextQuery('Hello World', 'hello')).toBe('<mark class="text-match">Hello</mark> World')
  })

  it('highlights multiple occurrences', () => {
    expect(highlightTextQuery('cat and cat', 'cat')).toBe('<mark class="text-match">cat</mark> and <mark class="text-match">cat</mark>')
  })

  it('preserves original case of matched text in mark tag', () => {
    expect(highlightTextQuery('WORLD', 'world')).toBe('<mark class="text-match">WORLD</mark>')
  })

  it('returns escaped text when there is no match', () => {
    expect(highlightTextQuery('hello world', 'xyz')).toBe('hello world')
  })

  it('treats regex special characters in query literally', () => {
    expect(highlightTextQuery('price: 1+1=2', '1+1')).toBe('price: <mark class="text-match">1+1</mark>=2')
  })

  it('escapes HTML in the source text', () => {
    expect(highlightTextQuery('<b>bold</b>', 'nomatch')).toBe('&lt;b&gt;bold&lt;/b&gt;')
  })

  it('escapes HTML inside highlighted match (XSS in query/text)', () => {
    expect(highlightTextQuery('<script>alert(1)</script>', 'script')).toBe('&lt;<mark class="text-match">script</mark>&gt;alert(1)&lt;/<mark class="text-match">script</mark>&gt;')
  })

  it('does not produce a mark tag when query matches nothing after escaping', () => {
    const result = highlightTextQuery('plain text', '<img src=x>')
    expect(result).toBe('plain text')
    expect(result).not.toContain('<mark')
  })

  it('returns escaped text when query is empty or whitespace', () => {
    expect(highlightTextQuery('<i>x</i>', '')).toBe('&lt;i&gt;x&lt;/i&gt;')
    expect(highlightTextQuery('<i>x</i>', '   ')).toBe('&lt;i&gt;x&lt;/i&gt;')
  })

  it('returns empty string for null text', () => {
    expect(highlightTextQuery(null, 'query')).toBe('')
  })

  it('returns empty string for undefined text', () => {
    expect(highlightTextQuery(undefined, 'query')).toBe('')
  })

  it('returns empty string for empty text', () => {
    expect(highlightTextQuery('', 'query')).toBe('')
  })

  it('trims the query before matching', () => {
    expect(highlightTextQuery('hello world', '  world  ')).toBe('hello <mark class="text-match">world</mark>')
  })

  it('highlights match at the start and end of text', () => {
    expect(highlightTextQuery('word middle word', 'word')).toBe('<mark class="text-match">word</mark> middle <mark class="text-match">word</mark>')
  })
})

describe('normalizeString', () => {
  it('trims whitespace', () => {
    expect(normalizeString('  hello  ')).toBe('hello')
  })

  it('converts to lowercase', () => {
    expect(normalizeString('HeLLo')).toBe('hello')
  })

  it('removes inner whitespace', () => {
    expect(normalizeString('hello world')).toBe('helloworld')
  })

  it('removes punctuation', () => {
    expect(normalizeString('hello, world!')).toBe('helloworld')
  })

  it('removes unicode punctuation', () => {
    expect(normalizeString('«привет» — мир')).toBe('приветмир')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeString('')).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeString('   ')).toBe('')
  })
})
