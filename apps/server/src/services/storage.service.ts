import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { UPLOAD_STORAGE, UPLOADS_PATH } from '../config'
import { s3Service } from './s3.service'

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
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    await Bun.write(fullPath, buffer)
    return key
  }

  async deleteFile(key: string): Promise<void> {
    const fullPath = path.join(UPLOADS_PATH, key)
    if (existsSync(fullPath)) {
      rmSync(fullPath)
    }
  }

  async deleteFolder(prefix: string): Promise<void> {
    const fullPath = path.join(UPLOADS_PATH, prefix)
    if (existsSync(fullPath)) {
      rmSync(fullPath, { recursive: true, force: true })
    }
  }

  async getFile(key: string): Promise<{ buffer: Uint8Array, contentType: string } | null> {
    const fullPath = path.join(UPLOADS_PATH, key)
    if (!existsSync(fullPath)) {
      return null
    }
    const buffer = readFileSync(fullPath)

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

    return { buffer: new Uint8Array(buffer), contentType }
  }

  async listDumpFolders(prefix: string): Promise<string[]> {
    const fullPath = path.join(UPLOADS_PATH, prefix)
    if (!existsSync(fullPath))
      return []

    const entries = readdirSync(fullPath)
    return entries
      .filter(entry => statSync(path.join(fullPath, entry)).isDirectory())
      .map(entry => `${prefix}/${entry}/`)
  }

  async listFilesInFolder(prefix: string): Promise<string[]> {
    const fullPath = path.join(UPLOADS_PATH, prefix)
    if (!existsSync(fullPath))
      return []

    const entries = readdirSync(fullPath)
    return entries
      .filter(entry => statSync(path.join(fullPath, entry)).isFile())
      .map(entry => `${prefix}/${entry}`)
  }
}

class S3StorageAdapter implements IStorageService {
  async uploadFile(key: string, buffer: Uint8Array | Buffer | ArrayBuffer, contentType?: string): Promise<string> {
    await s3Service.uploadFile(key, buffer, contentType)
    return key
  }

  async deleteFile(key: string): Promise<void> {
    await s3Service.deleteFile(key)
  }

  async deleteFolder(prefix: string): Promise<void> {
    await s3Service.deleteFolder(prefix)
  }

  async getFile(key: string): Promise<{ buffer: Uint8Array, contentType: string } | null> {
    return await s3Service.getFile(key)
  }

  async listDumpFolders(prefix: string): Promise<string[]> {
    return await s3Service.listDumpFolders(prefix)
  }

  async listFilesInFolder(prefix: string): Promise<string[]> {
    return await s3Service.listFilesInFolder(prefix)
  }
}

export const storageService: IStorageService = UPLOAD_STORAGE === 's3' ? new S3StorageAdapter() : new LocalStorageService()
