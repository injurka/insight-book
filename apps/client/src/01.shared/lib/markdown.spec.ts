// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { formatMarkdown } from './markdown'

describe('formatMarkdown', () => {
  describe('empty and falsy input', () => {
    it('returns empty string for empty input', () => {
      expect(formatMarkdown('')).toBe('')
    })

    it('returns empty string for whitespace-only input', () => {
      expect(formatMarkdown('   ')).toBe('')
    })

    it('trims leading and trailing whitespace', () => {
      const result = formatMarkdown('  x **hello**  ')
      expect(result).toContain('<strong>hello</strong>')
      expect(result).toBe(result.trim())
    })
  })

  describe('bold and italic', () => {
    it('formats bold text with **', () => {
      expect(formatMarkdown('this is **bold** text')).toContain('<strong>bold</strong>')
    })

    it('formats italic text with *', () => {
      expect(formatMarkdown('this is *italic* text')).toContain('<em>italic</em>')
    })

    it('formats bold and italic in the same string', () => {
      const result = formatMarkdown('**bold** and *italic*')
      expect(result).toContain('<em>italic</em>')
      expect(result).toContain('bold')
    })
  })

  describe('headings', () => {
    it('formats h2 and h3 headings', () => {
      const result = formatMarkdown('# One\n## Two\n### Three')
      expect(result).toContain('<h2>Two</h2>')
      expect(result).toContain('<h3>Three</h3>')
    })

    it('only treats heading markers at line start as headings', () => {
      expect(formatMarkdown('text # not a heading')).toContain('# not a heading')
      expect(formatMarkdown('text # not a heading')).not.toContain('<h1>')
    })
  })

  describe('lists', () => {
    it('wraps dash list items into ul/li', () => {
      const result = formatMarkdown('- one\n- two')
      expect(result).toContain('<li>one</li>')
      expect(result).toContain('<li>two</li>')
    })

    it('groups consecutive list items into a single ul', () => {
      const result = formatMarkdown('intro\n- one\n- two\ntail')
      expect(result).toContain('<ul>')
      expect(result).toContain('<li>one</li><li>two</li>')
      expect(result).toContain('tail')
    })

    it('wraps asterisk list items into li', () => {
      const result = formatMarkdown('* one\n* two')
      expect(result).toContain('<li>one</li>')
      expect(result).toContain('<li>two</li>')
    })

    it('keeps text after the list', () => {
      const result = formatMarkdown('intro\n- item\noutro')
      expect(result).toContain('<ul><li>item</li></ul>')
      expect(result).toContain('outro')
    })
  })

  describe('code blocks', () => {
    it('formats a fenced code block with a language', () => {
      const result = formatMarkdown('```ts\nconst a = 1\n```')
      expect(result).toContain('<code class="chat-code language-ts">')
      expect(result).toContain('const a = 1')
    })

    it('keeps the pre wrapper when the block is not the first node', () => {
      const result = formatMarkdown('intro\n```ts\ncode\n```')
      expect(result).toContain('<pre class="chat-code-block language-ts">')
      expect(result).toContain('<code class="chat-code language-ts">')
    })

    it('defaults to language-javascript for a block without language', () => {
      const result = formatMarkdown('```\ncode\n```')
      expect(result).toContain('language-javascript')
    })

    it('treats an unknown language as a plain css class', () => {
      const result = formatMarkdown('```brainfuck\n+++\n```')
      expect(result).toContain('language-brainfuck')
      expect(result).toContain('+++')
    })

    it('lowercases the language name', () => {
      const result = formatMarkdown('```TypeScript\nlet x = 1\n```')
      expect(result).toContain('language-typescript')
    })

    it('escapes HTML inside code blocks', () => {
      const result = formatMarkdown('```html\n<div>&amp;</div>\n```')
      expect(result).toContain('&lt;div&gt;&amp;amp;&lt;/div&gt;')
      expect(result).not.toContain('<div>')
    })

    it('does not apply markdown formatting inside code blocks', () => {
      const result = formatMarkdown('```\n**not bold**\n```')
      expect(result).not.toContain('<strong>')
      expect(result).toContain('**not bold**')
    })

    it('restores multiple code blocks in order', () => {
      const result = formatMarkdown('```js\nfirst\n```\ntext\n```js\nsecond\n```')
      const firstIndex = result.indexOf('first')
      const secondIndex = result.indexOf('second')
      expect(firstIndex).toBeGreaterThan(-1)
      expect(secondIndex).toBeGreaterThan(firstIndex)
    })
  })

  describe('inline code', () => {
    it('formats inline code', () => {
      expect(formatMarkdown('use `npm install` here')).toContain('<code class="chat-code">npm install</code>')
    })

    it('escapes HTML inside inline code', () => {
      const result = formatMarkdown('`<b>bold</b>`')
      expect(result).toContain('&lt;b&gt;bold&lt;/b&gt;')
      expect(result).not.toContain('<b>')
    })
  })

  describe('line breaks', () => {
    it('converts newlines in plain text to <br>', () => {
      const result = formatMarkdown('line one\nline two')
      expect(result).toContain('<br>')
      expect(result).toContain('line two')
    })
  })

  describe('dividers', () => {
    it('formats horizontal dividers --- as <hr>', () => {
      const result = formatMarkdown('intro\nsection 1\n---\nsection 2')
      expect(result).toContain('<hr>')
      expect(result).toContain('section 1')
      expect(result).toContain('section 2')
    })

    it('formats horizontal dividers *** as <hr>', () => {
      const result = formatMarkdown('intro\ntop\n***\nbottom')
      expect(result).toContain('<hr>')
      expect(result).toContain('top')
      expect(result).toContain('bottom')
    })
  })

  describe('tables', () => {
    it('formats markdown tables into table/thead/tbody/tr/th/td', () => {
      const md = `intro
| Header 1 | Header 2 |
| :--- | :---: |
| Cell 1 | Cell 2 |
outro`
      const result = formatMarkdown(md)
      expect(result).toContain('<table class="markdown-table">')
      expect(result).toContain('<thead>')
      expect(result).toContain('<tbody>')
      expect(result).toContain('<th align="left">Header 1</th>')
      expect(result).toContain('<th align="center">Header 2</th>')
      expect(result).toContain('<td align="left">Cell 1</td>')
      expect(result).toContain('<td align="center">Cell 2</td>')
    })

    it('supports bold inside table cells', () => {
      const md = `intro
| Type | Formula |
|---|---|
| **Affirmative** | Subject + Verb |`
      const result = formatMarkdown(md)
      expect(result).toContain('<strong>Affirmative</strong>')
    })
  })

  describe('ordered lists', () => {
    it('wraps numbered items into ol/li', () => {
      const result = formatMarkdown('intro\n1. First item\n2. Second item\noutro')
      expect(result).toContain('<ol>')
      expect(result).toContain('<li>First item</li>')
      expect(result).toContain('<li>Second item</li>')
      expect(result).toContain('</ol>')
    })
  })

  describe('blockquotes', () => {
    it('wraps quote lines into blockquote', () => {
      const result = formatMarkdown('intro\n> Important quote\noutro')
      expect(result).toContain('<blockquote>')
      expect(result).toContain('Important quote')
      expect(result).toContain('</blockquote>')
    })
  })

  describe('hTML sanitization', () => {
    it('strips raw HTML tags not generated by the parser', () => {
      // DOMPurify сконфигурирован только на теги парсера — чужой HTML вырезается, текст остаётся
      const result = formatMarkdown('hello <div>world</div>')
      expect(result).not.toContain('<div>')
      expect(result).toContain('world')
    })

    it('removes script tags', () => {
      const result = formatMarkdown('<script>alert(1)</script>safe')
      expect(result).not.toContain('<script>')
      expect(result).toContain('safe')
    })

    it('neutralizes event handler attributes', () => {
      // Сырой HTML экранируется до санитизации — onerror остаётся инертным текстом
      const result = formatMarkdown('<img src=x onerror=alert(1)>')
      expect(result).not.toContain('<img')
      expect(result).toContain('&lt;img')
    })
  })

  describe('content preservation', () => {
    it('preserves the first text node and block wrapper', () => {
      expect(formatMarkdown('line one\nline two')).toBe('line one<br>line two')
      expect(formatMarkdown('this is **bold**')).toBe('this is <strong>bold</strong>')
      expect(formatMarkdown('# Heading')).toBe('<h1>Heading</h1>')
      expect(formatMarkdown('```ts\ncode\n```')).toContain('<pre class="chat-code-block language-ts">')
    })

    it('preserves placeholder-like input and does not recursively restore code', () => {
      const result = formatMarkdown('%%BLOCK_PLACEHOLDER_0%% `first` `%%BLOCK_PLACEHOLDER_1%%`')
      expect(result).toContain('%%BLOCK_PLACEHOLDER_0%%')
      expect(result).toContain('<code class="chat-code">first</code>')
      expect(result).toContain('<code class="chat-code">%%BLOCK_PLACEHOLDER_1%%</code>')
    })

    it('preserves replacement tokens in code', () => {
      expect(formatMarkdown('`$& $`')).toBe('<code class="chat-code">$&amp; $</code>')
    })

    it('supports C++ and hyphenated language identifiers', () => {
      expect(formatMarkdown('```c++\nx\n```')).toContain('language-c++')
      expect(formatMarkdown('```objective-c\nx\n```')).toContain('language-objective-c')
    })
  })
})
