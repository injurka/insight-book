import type { S3Config } from './s3.service'
import fs from 'node:fs/promises'
import path from 'node:path'
import { DUMP_STORAGE, UPLOAD_STORAGE, UPLOADS_PATH } from '../config'
import { S3Service, s3Service } from './s3.service'

export interface IStorageService {
  uploadFile: (key: string, buffer: Uint8Array | Buffer | ArrayBuffer, contentType?: string) => Promise<string>
  deleteFile: (key: string) => Promise<void>
  deleteFolder: (prefix: string) => Promise<void>
  getFile: (key: string) => Promise<{ buffer: Uint8Array, contentType: string } | null>
  listDumpFolders: (prefix: string) => Promise<string[]>
  listFilesInFolder: (prefix: string) => Promise<string[]>
}

class LocalStorageService implements IStorageService {
  async uploadFile(key: string, buffer: Uint8Array | Buffer | ArrayBuffer, _contentType?: string): Promise<string> {
    const fullPath = path.join(UPLOADS_PATH, key)
    const dir = path.dirname(fullPath)
    try {
      await fs.access(dir)
    }
    catch {
      await fs.mkdir(dir, { recursive: true })
    }
    await Bun.write(fullPath, buffer)
    return key
  }

  async deleteFile(key: string): Promise<void> {
    const fullPath = path.join(UPLOADS_PATH, key)
    try {
      await fs.rm(fullPath)
    }
    catch {}
  }

  async deleteFolder(prefix: string): Promise<void> {
    const fullPath = path.join(UPLOADS_PATH, prefix)
    try {
      await fs.rm(fullPath, { recursive: true, force: true })
    }
    catch {}
  }

  async getFile(key: string): Promise<{ buffer: Uint8Array, contentType: string } | null> {
    const fullPath = path.join(UPLOADS_PATH, key)
    let buffer: Uint8Array
    try {
      const fileBuffer = await fs.readFile(fullPath)
      buffer = new Uint8Array(fileBuffer)
    }
    catch {
      return null
    }

    // Attempt basic content type inference
    let contentType = 'application/octet-stream'
    if (key.endsWith('.png'))
      contentType = 'image/png'
    else if (key.endsWith('.jpg') || key.endsWith('.jpeg'))
      contentType = 'image/jpeg'
    else if (key.endsWith('.webp'))
      contentType = 'image/webp'
    else if (key.endsWith('.json'))
      contentType = 'application/json'
    else if (key.endsWith('.sqlite'))
      contentType = 'application/vnd.sqlite3'
    else if (key.endsWith('.epub'))
      contentType = 'application/epub+zip'
    else if (key.endsWith('.cbz'))
      contentType = 'application/vnd.comicbook+zip'
    else if (key.endsWith('.fb2'))
      contentType = 'text/xml'

    return { buffer, contentType }
  }

  async listDumpFolders(prefix: string): Promise<string[]> {
    const fullPath = path.join(UPLOADS_PATH, prefix)
    try {
      const entries = await fs.readdir(fullPath)
      const results = []
      for (const entry of entries) {
        const stat = await fs.stat(path.join(fullPath, entry))
        if (stat.isDirectory()) {
          results.push(`${prefix}/${entry}/`)
        }
      }
      return results
    }
    catch {
      return []
    }
  }

  async listFilesInFolder(prefix: string): Promise<string[]> {
    const fullPath = path.join(UPLOADS_PATH, prefix)
    try {
      const entries = await fs.readdir(fullPath)
      const results = []
      for (const entry of entries) {
        const stat = await fs.stat(path.join(fullPath, entry))
        if (stat.isFile()) {
          results.push(`${prefix}/${entry}`)
        }
      }
      return results
    }
    catch {
      return []
    }
  }
}

class S3StorageAdapter implements IStorageService {
  private s3: S3Service

  constructor(s3: S3Service) {
    this.s3 = s3
  }

  async uploadFile(key: string, buffer: Uint8Array | Buffer | ArrayBuffer, contentType?: string): Promise<string> {
    await this.s3.uploadFile(key, buffer, contentType)
    return key
  }

  async deleteFile(key: string): Promise<void> {
    await this.s3.deleteFile(key)
  }

  async deleteFolder(prefix: string): Promise<void> {
    await this.s3.deleteFolder(prefix)
  }

  async getFile(key: string): Promise<{ buffer: Uint8Array, contentType: string } | null> {
    return await this.s3.getFile(key)
  }

  async listDumpFolders(prefix: string): Promise<string[]> {
    return await this.s3.listDumpFolders(prefix)
  }

  async listFilesInFolder(prefix: string): Promise<string[]> {
    return await this.s3.listFilesInFolder(prefix)
  }
}

/** Media storage — books, covers, avatars (uses S3_* or UPLOADS_PATH). */
export const storageService: IStorageService = UPLOAD_STORAGE === 's3'
  ? new S3StorageAdapter(s3Service)
  : new LocalStorageService()

/** Dump storage — database snapshots (uses DUMP_S3_* when DUMP_STORAGE=s3, otherwise falls back to UPLOADS_PATH). */
function resolveDumpStorage(): IStorageService {
  if (DUMP_STORAGE !== 's3')
    return new LocalStorageService()

  const config: S3Config = {
    bucket: process.env.DUMP_S3_BUCKET || 'insight-book-dumps',
    region: process.env.DUMP_S3_REGION || 'default',
    endpoint: process.env.DUMP_S3_ENDPOINT,
    accessKey: process.env.DUMP_S3_ACCESS_KEY || (process.env.S3_ACCESS_KEY || ''),
    secretKey: process.env.DUMP_S3_SECRET_KEY || (process.env.S3_SECRET_KEY || ''),
  }

  const dumpS3 = new S3Service(config)
  return new S3StorageAdapter(dumpS3)
}

export const dumpStorageService: IStorageService = resolveDumpStorage()
