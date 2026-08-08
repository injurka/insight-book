import type { APIRequestContext } from '@playwright/test'
import { deflateRawSync } from 'node:zlib'

/**
 * Минимальный ZIP-архив (deflate) без внешних зависимостей —
 * достаточно для EPUB, который сервер распаковывает через epub2/adm-zip.
 */
function createZip(entries: { name: string, data: Buffer }[]): Buffer {
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const compressed = deflateRawSync(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034B50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // UTF-8 flag
    local.writeUInt16LE(8, 8) // deflate
    local.writeUInt16LE(0, 10) // time
    local.writeUInt16LE(0, 12) // date
    local.writeUInt32LE(crc32(data), 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)

    chunks.push(local, nameBuf, compressed)

    const cent = Buffer.alloc(46)
    cent.writeUInt32LE(0x02014B50, 0)
    cent.writeUInt16LE(20, 4)
    cent.writeUInt16LE(20, 6)
    cent.writeUInt16LE(0x0800, 8)
    cent.writeUInt16LE(8, 10)
    cent.writeUInt16LE(0, 12)
    cent.writeUInt16LE(0, 14)
    cent.writeUInt32LE(crc32(data), 16)
    cent.writeUInt32LE(compressed.length, 20)
    cent.writeUInt32LE(data.length, 24)
    cent.writeUInt16LE(nameBuf.length, 28)
    cent.writeUInt32LE(offset, 42)
    central.push(Buffer.concat([cent, nameBuf]))

    offset += 30 + nameBuf.length + compressed.length
  }

  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054B50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)

  return Buffer.concat([...chunks, centralBuf, end])
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let crc = 0xFFFFFFFF
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/**
 * Хелперы для e2e/tests/reader-ai.spec.ts:
 * - генерация минимального валидного EPUB (сервер парсит его через epub2);
 * - загрузка книги через API (POST /api/auth/login + POST /api/books/upload).
 */

export const E2E_SERVER_URL = `http://127.0.0.1:${process.env.E2E_SERVER_PORT || 4455}`

const CHAPTER_TEXT = [
  'His quixotic plan surprised everyone in the village.',
  'She opened the ancient book and smiled softly.',
  'The luminous moon hung above the quiet harbor.',
].join(' ')

/** Минимальный EPUB: mimetype + container.xml + content.opf + toc.ncx + chapter1.xhtml */
export function buildMinimalEpub(title: string): Buffer {
  return createZip([
    { name: 'mimetype', data: Buffer.from('application/epub+zip') },
    {
      name: 'META-INF/container.xml',
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`),
    },
    {
      name: 'OEBPS/content.opf',
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">e2e-reader-ai-001</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>E2E Tests</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapter1"/>
  </spine>
</package>`),
    },
    {
      name: 'OEBPS/toc.ncx',
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="e2e-reader-ai-001"/>
  </head>
  <docTitle><text>${title}</text></docTitle>
  <navMap>
    <navPoint id="navPoint-1" playOrder="1">
      <navLabel><text>Chapter 1</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`),
    },
    {
      name: 'OEBPS/chapter1.xhtml',
      data: Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body>
  <h1>Chapter 1</h1>
  <p>${CHAPTER_TEXT}</p>
</body>
</html>`),
    },
  ])
}

export interface UploadedBook {
  id: number
  title: string
  language: string
}

/** Логин admin/admin → загрузка epub → возвращает созданную книгу */
export async function uploadBookViaApi(
  request: APIRequestContext,
  title: string,
): Promise<{ book: UploadedBook, token: string }> {
  const loginRes = await request.post(`${E2E_SERVER_URL}/api/auth/login`, {
    data: { login: 'admin', password: 'admin' },
  })
  if (!loginRes.ok())
    throw new Error(`E2E login failed: ${loginRes.status()} ${await loginRes.text()}`)
  const { token } = await loginRes.json()

  const epub = buildMinimalEpub(title)
  const uploadRes = await request.post(`${E2E_SERVER_URL}/api/books/upload`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name: `${title.replace(/\s+/g, '_').toLowerCase()}.epub`,
        mimeType: 'application/epub+zip',
        buffer: epub,
      },
    },
    timeout: 60_000,
  })
  if (!uploadRes.ok())
    throw new Error(`E2E book upload failed: ${uploadRes.status()} ${await uploadRes.text()}`)

  const { book } = await uploadRes.json()
  return { book, token }
}
