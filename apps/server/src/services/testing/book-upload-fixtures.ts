import AdmZip from 'adm-zip'
import { createMinimalPdfBuffer, createSyntheticMobiBuffer } from './book-binary-fixtures'

export const bodyText = 'She reads an original book in a quiet library.'
const chapterTitle = 'Chapter One'
const chineseText = '她在图书馆读一本有趣的书，这是一本中文书。'
export const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
export const widePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAAD0lEQVR4nGP4z8Dw/z8DAAr8Av5QCyxtAAAAAElFTkSuQmCC', 'base64')
const xml = '<?xml version="1.0" encoding="utf-8"?>'

function zip(entries: Record<string, string | Buffer>) {
  const archive = new AdmZip()

  for (const [name, value] of Object.entries(entries))
    archive.addFile(name, Buffer.from(value))

  return archive.toBuffer()
}

function rar(entries: Record<string, string | Buffer>) {
  function header(type: number, flags: number, body: Buffer) {
    const result = Buffer.alloc(7 + body.length)
    result[2] = type
    result.writeUInt16LE(flags, 3)
    result.writeUInt16LE(result.length, 5)
    body.copy(result, 7)
    result.writeUInt16LE(Bun.hash.crc32(result.subarray(2)) & 0xFFFF)

    return result
  }

  const blocks = [Buffer.from('526172211a0700', 'hex'), header(0x73, 0, Buffer.alloc(6))]

  for (const [name, value] of Object.entries(entries)) {
    const data = Buffer.from(value)
    const filename = Buffer.from(name)
    const info = Buffer.alloc(25 + filename.length)
    info.writeUInt32LE(data.length, 0)
    info.writeUInt32LE(data.length, 4)
    info[8] = 3
    info.writeUInt32LE(Bun.hash.crc32(data), 9)
    info[17] = 20
    info[18] = 0x30
    info.writeUInt16LE(filename.length, 19)
    info.writeUInt32LE(0x81A4, 21)
    filename.copy(info, 25)
    blocks.push(header(0x74, 0x8000, info), data)
  }

  blocks.push(header(0x7B, 0, Buffer.alloc(0)))

  return Buffer.concat(blocks)
}

function epub(version: 2 | 3) {
  const chapter = (content: string) => `${xml}<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter</title></head><body>${content}</body></html>`
  const entries = {
    'mimetype': 'application/epub+zip',
    'META-INF/container.xml': `${xml}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
    'OPS/content.opf': `${xml}<package xmlns="http://www.idpf.org/2007/opf" version="${version}.0" unique-identifier="book">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book">test</dc:identifier><dc:title>EPUB sample</dc:title><dc:creator>Author Name</dc:creator><dc:language>zh-Hans</dc:language></metadata>
      <manifest>
        <item id="first" href="one/chapter.xhtml" media-type="application/xhtml+xml"/>
        <item id="second" href="two/chapter.xhtml" media-type="application/xhtml+xml"/>
        <item id="image" href="picture.png" media-type="image/png" properties="cover-image"/>
        ${version === 2 ? '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>' : '<item id="nav" href="navigation/nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>'}
      </manifest>
      <spine ${version === 2 ? 'toc="ncx"' : ''}><itemref idref="first"/><itemref idref="second"/></spine>
    </package>`,
    'OPS/one/chapter.xhtml': chapter(`<p>${chineseText.repeat(90)}</p>`),
    'OPS/two/chapter.xhtml': chapter(`<h1 id="second">第二章</h1><p>${chineseText.repeat(90)}</p><h2 id="detail">小节标题</h2><p>小节正文。</p><img src="../picture.png"/>`),
    'OPS/picture.png': png,
  }

  return zip(version === 2
    ? {
        ...entries,
        'OPS/toc.ncx': `${xml}<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap><navPoint id="second" playOrder="1"><navLabel><text>第二章</text></navLabel><content src="two/chapter.xhtml#second"/><navPoint id="detail" playOrder="2"><navLabel><text>小节标题</text></navLabel><content src="two/chapter.xhtml#detail"/></navPoint></navPoint></navMap></ncx>`,
      }
    : {
        ...entries,
        'OPS/navigation/nav.xhtml': `${xml}<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="../two/chapter.xhtml#second">第二章</a><ol><li><a href="../two/chapter.xhtml#detail">小节标题</a></li></ol></li></ol></nav></body></html>`,
      })
}

const fb2 = `${xml}<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:xlink="http://www.w3.org/1999/xlink"><description><title-info><book-title>FB2 sample</book-title><author><first-name>Author</first-name><last-name>Name</last-name></author><lang>zh-CN</lang><coverpage><image xlink:href="#cover.png"/></coverpage></title-info></description>
<body><section><p>${chineseText.repeat(90)}</p></section><section><title><p>第二章</p></title><p>章节开头。</p><section><title><p>小节标题</p></title><p>小节正文。</p></section><p>章节结尾。</p></section></body><binary id="cover.png" content-type="image/png">${png.toString('base64')}</binary></FictionBook>`

const docx = zip({
  'word/document.xml': `${xml}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${chapterTitle}</w:t></w:r></w:p><w:p><w:r><w:t>${bodyText}</w:t></w:r></w:p></w:body></w:document>`,
  'word/styles.xml': `${xml}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style></w:styles>`,
  'docProps/core.xml': `${xml}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>DOCX sample</dc:title><dc:creator>Author Name</dc:creator><dc:language>en</dc:language></cp:coreProperties>`,
  'docProps/thumbnail.png': png,
})

const mobi = Buffer.from(createSyntheticMobiBuffer({
  exthTitle: 'MOBI sample',
  author: 'Author Name',
  language: 'en',
  htmlChunks: [new TextEncoder().encode(`<h1>${chapterTitle}</h1><p>${bodyText}</p>`)],
}))

const comic = {
  'chapter/10.png': widePng,
  'chapter/2.png': png,
  'ComicInfo.xml': '<ComicInfo><Title>Comic sample</Title><Writer>Author Name</Writer><LanguageISO>zh</LanguageISO><Pages><Page Image="1" Bookmark="Second page"/><Page Image="99" Bookmark="Invalid bookmark"/></Pages></ComicInfo>',
}

const textFiles = [
  {
    names: ['sample.txt'],
    bytes: `Title: TXT sample\nAuthor: Author Name\nChapter 1\n\n${bodyText}`,
    title: 'TXT sample',
    toc: 'Chapter 1',
    type: 'txt',
  },
  {
    names: ['sample.md', 'sample.markdown'],
    bytes: `---\ntitle: Markdown sample\nauthor: Author Name\nlang: en\n---\n# ${chapterTitle}\n\n${bodyText}`,
    title: 'Markdown sample',
    toc: chapterTitle,
    type: 'md',
  },
  {
    names: ['sample.html', 'sample.htm'],
    bytes: `<html lang="en"><head><title>HTML sample</title><meta name="author" content="Author Name"></head><body><h1>${chapterTitle}</h1><p>${bodyText}</p></body></html>`,
    title: 'HTML sample',
    toc: chapterTitle,
    type: 'html',
  },
  { names: ['sample.srt'], bytes: `1\n00:00:01,000 --> 00:00:04,000\n${bodyText}\n`, type: 'srt' },
  { names: ['sample.vtt'], bytes: `WEBVTT\n\n00:01.000 --> 00:04.000\n${bodyText}\n`, type: 'srt' },
  { names: ['sample.ass', 'sample.ssa'], bytes: `[Script Info]\nTitle: Subtitle sample\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,${bodyText}\n`, type: 'srt' },
  {
    names: ['sample.docx'],
    bytes: docx,
    title: 'DOCX sample',
    toc: chapterTitle,
    type: 'docx',
    cover: true,
  },
  {
    names: ['sample.pdf'],
    bytes: Buffer.from(createMinimalPdfBuffer({
      title: 'PDF sample',
      bookmark: 'Chapter 1',
      author: 'Author Name',
      streamCommands: `BT /F1 18 Tf 1 0 0 1 72 720 Tm (Chapter 1) Tj /F1 12 Tf 1 0 0 1 72 680 Tm (${bodyText}) Tj ET`,
    })),
    title: 'PDF sample',
    bookmark: 'Chapter 1',
    toc: 'Chapter 1',
    type: 'pdf',
  },
  {
    names: ['sample.mobi', 'sample.azw', 'sample.azw3', 'sample.prc', 'unknown.bin'],
    bytes: mobi,
    title: 'MOBI sample',
    toc: chapterTitle,
    type: 'mobi',
  },
]

export const uploadFixtures = [
  ...textFiles.map(file => ({ ...file, language: 'en', body: bodyText })),
  {
    names: ['epub2.epub'],
    bytes: epub(2),
    type: 'epub',
    title: 'EPUB sample',
    toc: '小节标题',
    body: '小节正文。',
    language: 'zh',
    cover: true,
  },
  {
    names: ['epub3.EPUB'],
    bytes: epub(3),
    type: 'epub',
    title: 'EPUB sample',
    toc: '小节标题',
    body: '小节正文。',
    language: 'zh',
    cover: true,
  },
  {
    names: ['sample.fb2'],
    bytes: fb2,
    type: 'fb2',
    title: 'FB2 sample',
    toc: '小节标题',
    body: '小节正文。',
    language: 'zh',
    cover: true,
  },
  {
    names: ['sample.FB2.ZIP'],
    bytes: zip({ 'a.xml': '<not-a-book/>', 'book.fb2': fb2 }),
    type: 'fb2',
    title: 'FB2 sample',
    toc: '小节标题',
    body: '小节正文。',
    language: 'zh',
    cover: true,
  },
  {
    names: ['sample.cbz', 'sample.zip'],
    bytes: zip(comic),
    type: 'manga',
    title: 'Comic sample',
    toc: 'Second page',
    language: 'zh',
    cover: true,
  },
  {
    names: ['sample.cbr', 'sample.rar'],
    bytes: rar(comic),
    type: 'manga',
    title: 'Comic sample',
    toc: 'Second page',
    language: 'zh',
    cover: true,
  },
]
