import { describe, expect, it } from 'bun:test'
import { resolveBookUploadFormat } from './book-upload-format'

describe('resolveBookUploadFormat', () => {
  const encoder = new TextEncoder()

  it('recognizes EPUB from the ZIP mimetype entry when the filename ends in .bin', async () => {
    const header = new Uint8Array(78)
    const view = new DataView(header.buffer)
    view.setUint32(0, 0x04034B50, true)
    view.setUint16(26, 8, true)
    header.set(encoder.encode('mimetypeapplication/epub+zip'), 30)

    const file = new File([header], 'download.bin', { type: 'application/octet-stream' })

    expect(await resolveBookUploadFormat(file)).toMatchObject({ worker: 'processEpub', filename: 'download.bin.epub' })
  })

  it('recognizes MOBI with no supported filename extension', async () => {
    const header = new Uint8Array(78)
    header.set(encoder.encode('BOOKMOBI'), 60)

    const file = new File([header], '我在北京送快递', { type: 'application/octet-stream' })

    expect(await resolveBookUploadFormat(file)).toMatchObject({ worker: 'processMobi', filename: '我在北京送快递.mobi' })
  })

  it('keeps the case-insensitive compound FB2 suffix ahead of the generic ZIP suffix', async () => {
    const file = new File([], 'book.FB2.ZIP')

    expect(await resolveBookUploadFormat(file)).toMatchObject({ worker: 'processFb2', filename: file.name })
  })

  it('rejects generic binary data even when the advertised MIME type is EPUB', async () => {
    const file = new File([new Uint8Array(78)], 'download.bin', { type: 'application/epub+zip' })

    expect(await resolveBookUploadFormat(file)).toBeUndefined()
  })
})
