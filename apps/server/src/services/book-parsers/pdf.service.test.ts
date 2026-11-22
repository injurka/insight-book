import { describe, expect, it } from 'bun:test'
import { createMinimalPdfBuffer, createSyntheticMobiBuffer } from '../testing/book-binary-fixtures'
import { decompressPalmDocLz77, parseMobiBuffer } from './mobi.service'
import { parsePdfBuffer } from './pdf.service'

describe('mobi.service', () => {
  it('decompresses PalmDOC LZ77 literals, space+char pairs, and backreferences', () => {
    // Construct compressed stream for "the the!"
    // 't' (0x74), 'h' (0x68), 'e' (0x65),
    // 0x80 | dist=3, len=4 -> dist=3, len-3=1 -> (3 << 3) | 1 = 25 (0x19), preceded by ' ' (0x20)
    // Wait: let's test space+char (0xC0..0xFF) + backreference (0x80..0xBF):
    // 'A', 'B', 'C', space+'D' (0x80 | 0x44 = 0xC4), backreference dist=5 len=3 ('ABC'):
    // dist = 5 -> (5 << 3) | (3 - 3) = 40 = 0x28 -> [0x80, 0x28]
    const compressed = new Uint8Array([
      0x41, // 'A'
      0x42, // 'B'
      0x43, // 'C'
      0xC4, // ' ' + 'D'
      0x80,
      0x28, // copy 3 bytes from dist 5 -> 'ABC'
      0x02,
      0xD0,
      0x9F, // 2 literal high bytes (UTF-8 'П')
    ])

    const decompressed = decompressPalmDocLz77(compressed)
    const text = new TextDecoder('utf-8').decode(decompressed)

    expect(text).toBe('ABC DABCП')
  })

  it('parses synthetic MOBI buffer with EXTH metadata, LZ77 compression, and multi-record UTF-8', () => {
    const html = '<html><body><h1>Chapter 1</h1><p>Hello world from MOBI format.</p><h2>Section 1.1</h2><p>Второй абзац с кириллицей.</p></body></html>'
    const fullBytes = new TextEncoder().encode(html)

    // Split inside multi-byte UTF-8 Cyrillic sequence to verify cross-record concatenation before decoding
    const splitIndex = fullBytes.length - 25
    const chunk1 = fullBytes.subarray(0, splitIndex)
    const chunk2 = fullBytes.subarray(splitIndex)

    const mobiBytes = createSyntheticMobiBuffer({
      title: 'Raw Header Title',
      exthTitle: 'EXTH Updated Book Title',
      author: 'Isaac Asimov',
      language: 'en',
      compression: 2,
      htmlChunks: [chunk1, chunk2],
    })

    const parsed = parseMobiBuffer(mobiBytes, 'fallback.mobi')

    expect(parsed.title).toBe('EXTH Updated Book Title')
    expect(parsed.author).toBe('Isaac Asimov')
    expect(parsed.toc).toHaveLength(2)
    expect(parsed.toc[0]).toMatchObject({
      title: 'Chapter 1',
      level: 1,
      pageNum: 1,
    })
    expect(parsed.toc[1]).toMatchObject({
      title: 'Section 1.1',
      level: 2,
      pageNum: 1,
    })
    expect(parsed.pages).toHaveLength(1)
    expect(parsed.pages[0]).toContain('<h1>Chapter 1</h1>')
    expect(parsed.pages[0]).toContain('<p>Hello world from MOBI format.</p>')
    expect(parsed.pages[0]).toContain('<h2>Section 1.1</h2>')
    expect(parsed.pages[0]).toContain('<p>Второй абзац с кириллицей.</p>')
  })

  it('rejects encrypted MOBI content instead of importing unreadable text', () => {
    const bytes = createSyntheticMobiBuffer({
      compression: 1,
      htmlChunks: [new TextEncoder().encode('<p>Protected content</p>')],
    })
    const view = new DataView(bytes.buffer)
    const firstRecordOffset = view.getUint32(78)
    view.setUint16(firstRecordOffset + 12, 2)

    expect(() => parseMobiBuffer(bytes, 'protected.mobi')).toThrow('DRM-protected')
  })

  it('falls back to filename when EXTH and MOBI fullName are absent or generic', () => {
    const htmlBytes = new TextEncoder().encode('<p>Simple uncompressed paragraph.</p>')
    const mobiBytes = createSyntheticMobiBuffer({
      title: '',
      compression: 1,
      htmlChunks: [htmlBytes],
    })

    const parsed = parseMobiBuffer(mobiBytes, 'my-kindle-book.azw3')
    expect(parsed.title).toBe('my-kindle-book')
    expect(parsed.author).toBeNull()
    expect(parsed.pages[0]).toContain('<p>Simple uncompressed paragraph.</p>')
  })
})

describe('pdf.service', () => {
  it('parses PDF buffer, extracts metadata and headings, joins wrapped/hyphenated lines, and strips page numbers', async () => {
    const streamCommands = [
      'BT',
      '/F1 18 Tf',
      '1 0 0 1 72 720 Tm',
      '(Chapter 1) Tj',
      '/F1 12 Tf',
      '1 0 0 1 72 680 Tm',
      '(This is an inter-) Tj',
      '1 0 0 1 72 664 Tm',
      '(national book that continues) Tj',
      '1 0 0 1 72 648 Tm',
      '(across multiple lines.) Tj',
      '1 0 0 1 72 610 Tm',
      '(Second paragraph starts here.) Tj',
      '1 0 0 1 300 30 Tm',
      '(1) Tj',
      'ET',
    ].join('\n')

    const pdfBytes = createMinimalPdfBuffer({
      title: 'Deep Space Odyssey',
      author: 'Arthur Clarke',
      streamCommands,
    })

    const parsed = await parsePdfBuffer(pdfBytes, 'fallback-name.pdf')

    expect(parsed.title).toBe('Deep Space Odyssey')
    expect(parsed.author).toBe('Arthur Clarke')
    expect(parsed.language).toBe('en')
    expect(parsed.toc).toHaveLength(1)
    expect(parsed.toc[0]).toMatchObject({
      title: 'Chapter 1',
      pageNum: 1,
    })
    expect(parsed.pages).toHaveLength(1)
    expect(parsed.pages[0]).toContain('<h2>Chapter 1</h2>')
    expect(parsed.pages[0]).toContain('<p>This is an international book that continues across multiple lines.</p>')
    expect(parsed.pages[0]).toContain('<p>Second paragraph starts here.</p>')
    expect(parsed.pages[0]).not.toContain('<p>1</p>')
  })

  it('cleans generic Microsoft Word titles and ignored authors in PDF metadata', async () => {
    const streamCommands = [
      'BT',
      '/F1 12 Tf',
      '1 0 0 1 72 700 Tm',
      '(Hello PDF reader.) Tj',
      'ET',
    ].join('\n')

    const pdfBytes = createMinimalPdfBuffer({
      title: 'Microsoft Word - untitled.docx',
      author: 'Windows User',
      streamCommands,
    })

    const parsed = await parsePdfBuffer(pdfBytes, 'clean-fallback-title.pdf')

    expect(parsed.title).toBe('clean-fallback-title')
    expect(parsed.author).toBeNull()
    expect(parsed.pages[0]).toContain('<p>Hello PDF reader.</p>')
  })
})
