import { describe, expect, test } from 'bun:test'
import { splitIntoSentences } from './sentence-splitter'

describe('splitIntoSentences', () => {
  test('splits independent clauses at a semicolon', () => {
    const text = 'And one of the fallen angels, whose name was Uzziel, said, it was for man’s sake that we were cast down, for we would not bend our knee to him; let us test the Lord and see what He will do if we afflict their mightiest kingdoms with hunger.'

    expect(splitIntoSentences(text, 'en')).toEqual([
      'And one of the fallen angels, whose name was Uzziel, said, it was for man’s sake that we were cast down, for we would not bend our knee to him; ',
      'let us test the Lord and see what He will do if we afflict their mightiest kingdoms with hunger.',
    ])
  })

  test('preserves the source text exactly', () => {
    const text = 'First clause; second clause. Next sentence!'

    expect(splitIntoSentences(text, 'en').join('')).toBe(text)
  })
})

describe('multilingual sentence boundaries', () => {
  test('full width semicolons retain delimiters', () => {
    const text = '第一句； 第二句。第三句！'
    expect(splitIntoSentences(text, 'zh-CN')).toEqual(['第一句； ', '第二句。', '第三句！'])
  })
  test('fallback keeps punctuation attached and retains whitespace', () => {
    const text = 'First; second！\nThird。\n\nLast'
    expect(splitIntoSentences(text, 'invalid_locale')).toEqual(['First; ', 'second！', '\n', 'Third。', '\n\n', 'Last'])
    expect(splitIntoSentences(text, 'invalid_locale').join('')).toBe(text)
  })
})
