const BOOK_WORKERS = {
  '.epub': 'processEpub',
  '.fb2': 'processFb2',
  '.fb2.zip': 'processFb2',
  '.docx': 'processDocx',
  '.txt': 'processTxt',
  '.md': 'processMarkdown',
  '.markdown': 'processMarkdown',
  '.srt': 'processSubtitle',
  '.vtt': 'processSubtitle',
  '.ass': 'processSubtitle',
  '.ssa': 'processSubtitle',
  '.html': 'processHtml',
  '.htm': 'processHtml',
  '.pdf': 'processPdf',
  '.mobi': 'processMobi',
  '.azw': 'processMobi',
  '.azw3': 'processMobi',
  '.prc': 'processMobi',
  '.cbz': 'processCbz',
  '.cbr': 'processCbz',
  '.zip': 'processCbz',
  '.rar': 'processCbz',
} as const

const decoder = new TextDecoder()

async function detectBookExtension(file: Blob): Promise<'.epub' | '.mobi' | undefined> {
  const header = await file.slice(0, 78).arrayBuffer()

  if (header.byteLength < 78)
    return

  const view = new DataView(header)
  const bytes = new Uint8Array(header)

  // EPUB starts with an uncompressed ZIP entry named "mimetype" with no extra fields.
  if (view.getUint32(0, true) === 0x04034B50
    && view.getUint16(8, true) === 0
    && view.getUint16(26, true) === 8
    && view.getUint16(28, true) === 0
    && decoder.decode(bytes.subarray(30, 58)) === 'mimetypeapplication/epub+zip') {
    return '.epub'
  }

  // MOBI uses the Palm Database type and creator fields.
  if (decoder.decode(bytes.subarray(60, 68)) === 'BOOKMOBI')
    return '.mobi'
}

export async function resolveBookUploadFormat(file: File) {
  const filename = file.name.toLowerCase()
  const match = Object.entries(BOOK_WORKERS).find(([extension]) => filename.endsWith(extension))

  if (match) {
    const [extension, worker] = match

    return { extension, worker, filename: file.name }
  }

  const extension = await detectBookExtension(file)

  if (extension)
    return { extension, worker: BOOK_WORKERS[extension], filename: `${file.name || 'book'}${extension}` }
}
