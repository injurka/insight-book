import path from 'node:path'
import { MIME_OVERRIDES } from '../config'

export function getMimeOverride(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase()

  return MIME_OVERRIDES[ext] ?? null
}
