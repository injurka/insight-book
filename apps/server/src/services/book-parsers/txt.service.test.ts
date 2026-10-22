import { describe, expect, it } from 'bun:test'
import { parseMarkdownBuffer } from './markdown.service'
import { parseTxtBuffer } from './txt.service'

function encodeWindows1251(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)

    if (code < 0x80) {
      bytes[i] = code
    }
    else if (code >= 0x0410 && code <= 0x044F) {
      bytes[i] = code - 0x0410 + 0xC0
    }
    else if (code === 0x0401) {
      bytes[i] = 0xA8
    }
    else if (code === 0x0451) {
      bytes[i] = 0xB8
    }
    else {
      bytes[i] = 0x3F
    }
  }

  return bytes
}

describe('txt.service - parseTxtBuffer', () => {
  it('parses UTF-8 Chinese web novel with metadata, chapters, TOC, and HTML blocks', () => {
    const content = [
      '《诡秘之主》',
      '作者：爱潜水的乌贼',
      '',
      '第一章 绯红',
      '　　痛！好痛！头好痛！',
      '　　周明瑞只觉得脑袋像是被人用棒子狠狠抡了一下。',
      '',
      '第二章 占卜家',
      '　　克莱恩静静地听着，没有打断对方的话语。',
    ].join('\r\n')

    const bytes = new TextEncoder().encode(content)
    const parsed = parseTxtBuffer(bytes, 'lotm.txt')

    expect(parsed.title).toBe('诡秘之主')
    expect(parsed.author).toBe('爱潜水的乌贼')
    expect(parsed.language).toBe('zh')
    expect(parsed.toc).toHaveLength(2)
    expect(parsed.toc[0]).toEqual({
      id: 'sec-0',
      href: '',
      title: '第一章 绯红',
      order: 0,
      level: 1,
      pageNum: 1,
    })
    expect(parsed.toc[1]).toEqual({
      id: 'sec-1',
      href: '',
      title: '第二章 占卜家',
      order: 1,
      level: 1,
      pageNum: 1,
    })

    const fullHtml = parsed.pages.join('')
    expect(fullHtml).toContain('<h2>第一章 绯红</h2>')
    expect(fullHtml).toContain('<h2>第二章 占卜家</h2>')
    expect(fullHtml).toContain('<p>痛！好痛！头好痛！</p>')
  })

  it('auto-detects and decodes GB18030 / GBK encoded Chinese TXT', () => {
    // GBK bytes for:
    // "第一章 世界\n这是一段中文测试文本。"
    const gbkBytes = new Uint8Array([
      0xB5,
      0xDA,
      0xD2,
      0xBB,
      0xD5,
      0xC2,
      0x20,
      0xCA,
      0xC0,
      0xBD,
      0xE7,
      0x0A,
      0xD5,
      0xE2,
      0xCA,
      0xC7,
      0xD2,
      0xBB,
      0xB6,
      0xCE,
      0xD6,
      0xD0,
      0xCE,
      0xC4,
      0xB2,
      0xE2,
      0xCA,
      0xD4,
      0xCE,
      0xC4,
      0xB1,
      0xBE,
      0xA1,
      0xA3,
    ])

    const parsed = parseTxtBuffer(gbkBytes, 'gbk_novel.txt')

    expect(parsed.title).toBe('gbk_novel')
    expect(parsed.language).toBe('zh')
    expect(parsed.toc).toHaveLength(1)
    expect(parsed.toc[0].title).toBe('第一章 世界')
    expect(parsed.pages[0]).toContain('<h2>第一章 世界</h2>')
    expect(parsed.pages[0]).toContain('<p>这是一段中文测试文本。</p>')
  })

  it('auto-detects and decodes Windows-1251 encoded Russian TXT with chapter headings', () => {
    const ruText = [
      'Название: Путешествие на край света',
      'Автор: Иван Петров',
      '',
      'Глава 1. Начало',
      'В тот холодный осенний вечер туман опустился на старый город.',
      'Книга лежала на столе и ждала своего читателя.',
      '',
      'Глава 2. Дорога',
      'На рассвете путники отправились в далекий путь через лес.',
    ].join('\n')

    const cp1251Bytes = encodeWindows1251(ruText)
    const parsed = parseTxtBuffer(cp1251Bytes, 'fallback.txt')

    expect(parsed.title).toBe('Путешествие на край света')
    expect(parsed.author).toBe('Иван Петров')
    expect(parsed.language).toBe('ru')
    // "Книга лежала на столе и ждала своего читателя." ends with a period, so it should NOT be treated as a heading
    expect(parsed.toc).toHaveLength(2)
    expect(parsed.toc[0].title).toBe('Глава 1. Начало')
    expect(parsed.toc[1].title).toBe('Глава 2. Дорога')
    expect(parsed.pages[0]).toContain('<h2>Глава 1. Начало</h2>')
    expect(parsed.pages[0]).toContain('<p>Книга лежала на столе и ждала своего читателя.</p>')
  })
})

describe('markdown.service - parseMarkdownBuffer', () => {
  it('parses Markdown with YAML frontmatter, GFM tables, lists, code blocks, and multi-level TOC', () => {
    const mdContent = [
      '---',
      'title: "Архитектура систем"',
      'author: \'Алексей Смирнов\'',
      'lang: ru',
      '---',
      '',
      '# Введение в архитектуру',
      '',
      'Это основной текст первой главы с **жирным** и ~~зачеркнутым~~ текстом.',
      '',
      '## Сравнение подходов',
      '',
      '| Подход | Сложность |',
      '| --- | --- |',
      '| Монолит | Низкая |',
      '| Микросервисы | Высокая |',
      '',
      '### Примеры кода',
      '',
      '- Первый пункт',
      '- Второй пункт',
      '',
      '```ts',
      'const answer: number = 42',
      '```',
      '',
      '<script>alert("xss")</script>',
    ].join('\n')

    const bytes = new TextEncoder().encode(mdContent)
    const parsed = parseMarkdownBuffer(bytes, 'system-design.md')

    expect(parsed.title).toBe('Архитектура систем')
    expect(parsed.author).toBe('Алексей Смирнов')
    expect(parsed.language).toBe('ru')

    expect(parsed.toc).toHaveLength(3)
    expect(parsed.toc[0]).toMatchObject({
      id: 'sec-0',
      title: 'Введение в архитектуру',
      level: 1,
      order: 0,
    })
    expect(parsed.toc[1]).toMatchObject({
      id: 'sec-1',
      title: 'Сравнение подходов',
      level: 2,
      order: 1,
    })
    expect(parsed.toc[2]).toMatchObject({
      id: 'sec-2',
      title: 'Примеры кода',
      level: 3,
      order: 2,
    })

    const fullHtml = parsed.pages.join('')
    expect(fullHtml).toContain('<h1>Введение в архитектуру</h1>')
    expect(fullHtml).toContain('<table>')
    expect(fullHtml).toContain('<td>Микросервисы</td>')
    expect(fullHtml).toContain('<del>зачеркнутым</del>')
    expect(fullHtml).toContain('<ul>')
    expect(fullHtml).toContain('<pre><code')
    expect(fullHtml).not.toContain('<script>')
  })

  it('falls back to first H1 for title when frontmatter has no title, or filename when no H1 exists', () => {
    const mdWithH1 = new TextEncoder().encode('# Тайна третьей планеты\n\nТекст рассказа на русском языке.')
    const parsedWithH1 = parseMarkdownBuffer(mdWithH1, 'fallback-name.markdown')
    expect(parsedWithH1.title).toBe('Тайна третьей планеты')
    expect(parsedWithH1.author).toBeNull()
    expect(parsedWithH1.language).toBe('ru')

    const mdWithoutH1 = new TextEncoder().encode('Just a simple English paragraph without any headings at all.')
    const parsedWithoutH1 = parseMarkdownBuffer(mdWithoutH1, 'english-notes.markdown')
    expect(parsedWithoutH1.title).toBe('english-notes')
    expect(parsedWithoutH1.language).toBe('en')
    expect(parsedWithoutH1.toc).toHaveLength(0)
  })
})
