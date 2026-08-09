import zlib from 'node:zlib'

/**
 * Compresses a string or Buffer using Brotli compression into a Buffer.
 */
export function compressData(data: string | Buffer): Buffer {
  const input = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data
  return zlib.brotliCompressSync(input, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
    },
  })
}

/**
 * Decompresses a Brotli-compressed Buffer or Uint8Array back to string.
 * Gracefully falls back to plain UTF-8 if the input is uncompressed string/buffer.
 */
export function decompressData(data: Buffer | Uint8Array | string | null | undefined): string {
  if (!data)
    return ''
  if (typeof data === 'string')
    return data

  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
  if (buf.length === 0)
    return ''

  try {
    return zlib.brotliDecompressSync(buf).toString('utf-8')
  }
  catch {
    // Fallback if the data in DB was stored as plain UTF-8 text/buffer
    return buf.toString('utf-8')
  }
}
