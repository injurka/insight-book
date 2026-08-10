import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { logger } from '../utils/logger'

export interface S3Config {
  bucket: string
  region: string
  endpoint?: string
  accessKey: string
  secretKey: string
}

class S3Service {
  private client: S3Client
  private bucket: string

  constructor(config: S3Config) {
    this.bucket = config.bucket
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true,
    })
  }

  async uploadFile(key: string, buffer: Uint8Array | Buffer | ArrayBuffer, contentType?: string) {
    const bodyData = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bodyData,
        ContentType: contentType || 'application/octet-stream',
      }),
    )
  }

  async deleteFile(key: string) {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )
    }
    catch (error) {
      logger.error(error, `S3 Delete Error for key ${key}:`)
    }
  }

  async deleteFolder(prefix: string) {
    try {
      const keys = await this.listFilesInFolder(prefix)
      for (const key of keys) {
        await this.deleteFile(key)
      }
    }
    catch (error) {
      logger.error(error, `S3 DeleteFolder Error for prefix ${prefix}:`)
    }
  }

  async getFile(key: string): Promise<{ buffer: Uint8Array, contentType: string } | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )

      if (!response.Body)
        return null

      const byteArray = await response.Body.transformToByteArray()

      return {
        buffer: byteArray,
        contentType: response.ContentType || 'application/octet-stream',
      }
    }
    catch (error: unknown) {
      const err = error as Error & { name?: string, $metadata?: { httpStatusCode?: number } }
      if (err.name === 'NoSuchKey' || err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return null
      }
      throw error
    }
  }

  async checkConnection(): Promise<void> {
    try {
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.bucket }),
      )
    }
    catch (error: unknown) {
      const err = error as Error & { name?: string, $metadata?: { httpStatusCode?: number } }
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        logger.info(`⚠️ Bucket '${this.bucket}' not found. Attempting to create it...`)

        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
          logger.info(`✅ Bucket '${this.bucket}' created successfully.`)
        }
        catch (createError) {
          logger.error(`❌ Failed to create bucket '${this.bucket}'. Check your credentials and permissions.`)
          throw createError
        }
      }
      else {
        throw error
      }
    }
  }

  async listDumpFolders(prefix: string): Promise<string[]> {
    try {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix.endsWith('/') ? prefix : `${prefix}/`,
          Delimiter: '/',
        }),
      )
      return response.CommonPrefixes?.map(p => p.Prefix as string).filter(Boolean) || []
    }
    catch (error) {
      logger.error(error, `S3 ListDumpFolders Error for prefix ${prefix}:`)
      return []
    }
  }

  async listFilesInFolder(prefix: string): Promise<string[]> {
    try {
      let isTruncated = true
      let continuationToken: string | undefined
      const allKeys: string[] = []

      while (isTruncated) {
        const response = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          }),
        )

        const keys = response.Contents?.map(item => item.Key as string).filter(Boolean) || []
        allKeys.push(...keys)

        isTruncated = response.IsTruncated || false
        continuationToken = response.NextContinuationToken
      }

      return allKeys
    }
    catch (error) {
      logger.error(error, `S3 ListFilesInFolder Error for prefix ${prefix}:`)
      return []
    }
  }
}

/** Media S3 singleton — uses S3_* env vars for uploads (books, covers, avatars). */
export const s3Service = new S3Service({
  bucket: process.env.S3_BUCKET || 'insight-book-bucket',
  region: process.env.S3_REGION || 'default',
  endpoint: process.env.S3_ENDPOINT,
  accessKey: process.env.S3_ACCESS_KEY || '',
  secretKey: process.env.S3_SECRET_KEY || '',
})

export { S3Service }
