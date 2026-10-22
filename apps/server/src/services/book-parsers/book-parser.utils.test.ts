import { describe, expect, it } from 'bun:test'
import {
  decodeTextBuffer,
  decodeWindows1251,
  detectLanguageFromText,
  escapeHtml,
  HtmlPageBuilder,
} from './book-parser.utils'

describe('book-parser.utils', () => {
  it('decodes UTF-8 with BOM and without BOM', () => {
    const raw = new TextEncoder().encode('Привет, мир! 你好世界')
    const withBom = new Uint8Array([0xEF, 0xBB, 0xBF, ...raw])

    expect(decodeTextBuffer(raw)).toBe('Привет, мир! 你好世界')
    expect(decodeTextBuffer(withBom)).toBe('Привет, мир! 你好世界')
  })

  it('decodes Windows-1251 Russian text automatically', () => {
    // "Глава 1. Привет, мир! Это тестовая книга на русском языке."
    const cp1251Bytes = new Uint8Array([
      0xC3,
      0xEB,
      0xE0,
      0xE2,
      0xE0,
      0x20,
      0x31,
      0x2E,
      0x20,
      0xCF,
      0xF0,
      0xE8,
      0xE2,
      0xE5,
      0xF2,
      0x2C,
      0x20,
      0xEC,
      0xE8,
      0xF0,
      0x21,
      0x20,
      0xDD,
      0xF2,
      0xEE,
      0x20,
      0xF2,
      0xE5,
      0xF1,
      0xF2,
      0xEE,
      0xE2,
      0xE0,
      0xFF,
      0x20,
      0xEA,
      0xED,
      0xE8,
      0xE3,
      0xE0,
      0x20,
      0xED,
      0xE0,
      0x20,
      0xF0,
      0xF3,
      0xF1,
      0xF1,
      0xEA,
      0xEE,
      0xEC,
      0x20,
      0xFF,
      0xE7,
      0xFB,
      0xEA,
      0xE5,
      0x2E,
    ])

    expect(decodeWindows1251(cp1251Bytes)).toBe('Глава 1. Привет, мир! Это тестовая книга на русском языке.')
    expect(decodeTextBuffer(cp1251Bytes)).toBe('Глава 1. Привет, мир! Это тестовая книга на русском языке.')
  })

  it('detects languages accurately across scripts', () => {
    expect(detectLanguageFromText('这是一本关于人工智能和科学技术的中文小说，包含了大量的汉字内容。')).toBe('zh')
    expect(detectLanguageFromText('これは日本語のテスト文章です。ひらがなとカタカナと漢字が含まれています。')).toBe('ja')
    expect(detectLanguageFromText('이것은 한국어 텍스트 샘플입니다. 소설과 학습 자료를 지원합니다.')).toBe('ko')
    expect(detectLanguageFromText('Это длинный текст на русском языке для проверки автоматического определения языка.')).toBe('ru')
    expect(detectLanguageFromText('This is an English sample paragraph for testing automatic language detection.')).toBe('en')
  })

  it('paginates HTML blocks and calculates next block page number accurately', () => {
    const builder = new HtmlPageBuilder(50)
    expect(builder.getPageNumForNextBlock(30)).toBe(1)
    builder.pushBlock('<p>First block of thirty chars</p>\n', 30)

    // Next block of 25 chars exceeds 50 (30 + 25 >= 50), so it lands on page 2
    expect(builder.getPageNumForNextBlock(25)).toBe(2)
    builder.pushBlock('<h2>Heading on page two</h2>\n', 25)

    const pages = builder.finalize()
    expect(pages).toHaveLength(2)
    expect(pages[0]).toContain('First block')
    expect(pages[1]).toContain('Heading on page two')
  })

  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script attr="x">&</script>')).toBe('&lt;script attr=&quot;x&quot;&gt;&amp;&lt;/script&gt;')
  })
})
