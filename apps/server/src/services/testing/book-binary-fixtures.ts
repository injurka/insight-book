/**
 * Simple PalmDOC LZ77 encoder for test fixtures:
 * encodes ASCII (0x09..0x7F), space+char (0xC0..0xFF), and literal runs (0x01..0x08) for high bytes.
 */
function compressPalmDocLz77ForTest(input: Uint8Array): Uint8Array {
  const out: number[] = []
  let i = 0

  while (i < input.length) {
    const b = input[i]

    if (b === 0x00) {
      out.push(0x00)
      i++
    }
    else if (
      b === 0x20
      && i + 1 < input.length
      && input[i + 1] >= 0x40
      && input[i + 1] <= 0x7F
    ) {
      out.push(input[i + 1] ^ 0x80)
      i += 2
    }
    else if (b >= 0x09 && b <= 0x7F) {
      out.push(b)
      i++
    }
    else {
      // Encode 1..8 bytes literally using 0x01..0x08 prefix
      const run: number[] = []

      while (
        i < input.length
        && run.length < 8
        && (input[i] < 0x09 || input[i] >= 0x80)
      ) {
        run.push(input[i])
        i++
      }

      out.push(run.length, ...run)
    }
  }

  return new Uint8Array(out)
}

interface SyntheticMobiOptions {
  title?: string
  exthTitle?: string
  author?: string
  language?: string
  compression?: 1 | 2
  htmlChunks: Uint8Array[]
}

export function createSyntheticMobiBuffer(options: SyntheticMobiOptions): Uint8Array {
  const encoder = new TextEncoder()
  const compression = options.compression ?? 2

  const encodedRecords = options.htmlChunks.map(chunk =>
    compression === 2 ? compressPalmDocLz77ForTest(chunk) : chunk)

  const mobiHeaderLen = 232 // 0xE8 (>= 0xE4)
  const fullNameBytes = encoder.encode(options.title ?? 'Fallback Mobi Title')

  // Build EXTH records
  const exthRecords: Array<{ type: number, data: Uint8Array }> = []

  if (options.author) {
    exthRecords.push({ type: 100, data: encoder.encode(options.author) })
  }

  if (options.exthTitle) {
    exthRecords.push({ type: 503, data: encoder.encode(options.exthTitle) })
  }

  if (options.language) {
    exthRecords.push({ type: 524, data: encoder.encode(options.language) })
  }

  let exthBodyLen = 12 // 'EXTH' + len(4) + count(4)

  for (const rec of exthRecords) {
    exthBodyLen += 8 + rec.data.byteLength
  }

  // Pad EXTH to 4-byte alignment
  const exthTotalLen = Math.ceil(exthBodyLen / 4) * 4
  const fullNameOffset = 16 + mobiHeaderLen + exthTotalLen
  const rec0Len = fullNameOffset + fullNameBytes.byteLength + 4
  const rec0 = new Uint8Array(rec0Len)
  const rec0View = new DataView(rec0.buffer)

  // PalmDOC Header (16 bytes)
  rec0View.setUint16(0, compression, false) // compression
  rec0View.setUint16(8, encodedRecords.length, false) // textRecordCount
  rec0View.setUint16(10, 4096, false) // recordSize

  // MOBI Header (starts at 16)
  rec0.set(encoder.encode('MOBI'), 16)
  rec0View.setUint32(20, mobiHeaderLen, false) // headerLength
  rec0View.setUint32(24, 2, false) // mobiType (2 = book)
  rec0View.setUint32(28, 65001, false) // textEncoding (UTF-8)
  rec0View.setUint32(84, fullNameOffset, false) // fullNameOffset
  rec0View.setUint32(88, fullNameBytes.byteLength, false) // fullNameLength
  rec0View.setUint32(128, exthRecords.length > 0 ? 0x40 : 0, false) // exthFlags
  rec0View.setUint16(242, 0, false) // extraDataFlags

  // EXTH Header (starts at 16 + mobiHeaderLen)
  if (exthRecords.length > 0) {
    const exthStart = 16 + mobiHeaderLen
    rec0.set(encoder.encode('EXTH'), exthStart)
    rec0View.setUint32(exthStart + 4, exthTotalLen, false)
    rec0View.setUint32(exthStart + 8, exthRecords.length, false)

    let pos = exthStart + 12

    for (const rec of exthRecords) {
      rec0View.setUint32(pos, rec.type, false)
      rec0View.setUint32(pos + 4, 8 + rec.data.byteLength, false)
      rec0.set(rec.data, pos + 8)
      pos += 8 + rec.data.byteLength
    }
  }

  rec0.set(fullNameBytes, fullNameOffset)

  const allRecords = [rec0, ...encodedRecords]
  const numRecords = allRecords.length
  const pdbHeaderSize = 78 + numRecords * 8 + 2
  const totalSize = pdbHeaderSize + allRecords.reduce((acc, r) => acc + r.byteLength, 0)

  const pdb = new Uint8Array(totalSize)
  const pdbView = new DataView(pdb.buffer)

  pdb.set(encoder.encode('TestMOBI'.padEnd(31, '\0')), 0)
  pdb.set(encoder.encode('BOOKMOBI'), 60)
  pdbView.setUint16(76, numRecords, false)

  let currentOffset = pdbHeaderSize

  for (let i = 0; i < numRecords; i++) {
    pdbView.setUint32(78 + i * 8, currentOffset, false)
    pdbView.setUint32(78 + i * 8 + 4, i, false)
    pdb.set(allRecords[i], currentOffset)
    currentOffset += allRecords[i].byteLength
  }

  return pdb
}

export function createMinimalPdfBuffer(options: {
  title?: string
  author?: string
  streamCommands: string
  bookmark?: string
}): Uint8Array {
  const objects: string[] = []

  // 1: Catalog
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R${options.bookmark ? ' /Outlines 7 0 R' : ''} >>\nendobj\n`)
  // 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
  // 3: Page
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n')
  // 4: Font
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')
  // 5: Contents stream
  const streamBytes = new TextEncoder().encode(options.streamCommands)
  objects.push(`5 0 obj\n<< /Length ${streamBytes.byteLength} >>\nstream\n${options.streamCommands}\nendstream\nendobj\n`)
  // 6: Info dictionary
  const infoTitle = options.title ? `/Title (${options.title})` : ''
  const infoAuthor = options.author ? `/Author (${options.author})` : ''
  objects.push(`6 0 obj\n<< ${infoTitle} ${infoAuthor} >>\nendobj\n`)

  if (options.bookmark) {
    objects.push('7 0 obj\n<< /Type /Outlines /First 8 0 R /Last 8 0 R /Count 1 >>\nendobj\n')
    objects.push(`8 0 obj\n<< /Title (${options.bookmark}) /Parent 7 0 R /Dest [3 0 R /Fit] >>\nendobj\n`)
  }

  let pdfStr = '%PDF-1.4\n'
  const offsets: number[] = []

  for (const obj of objects) {
    offsets.push(new TextEncoder().encode(pdfStr).byteLength)
    pdfStr += obj
  }

  const xrefOffset = new TextEncoder().encode(pdfStr).byteLength
  pdfStr += `xref\n0 ${objects.length + 1}\n`
  pdfStr += '0000000000 65535 f \n'

  for (const offset of offsets) {
    pdfStr += `${String(offset).padStart(10, '0')} 00000 n \n`
  }

  pdfStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\n`
  pdfStr += `startxref\n${xrefOffset}\n%%EOF\n`

  return new TextEncoder().encode(pdfStr)
}
