import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

class S3Service {
  private client: S3Client
  private bucket: string

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'insight-book-bucket'
    this.client = new S3Client({
      region: process.env.S3_REGION || 'default',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
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
      console.error(`S3 Delete Error for key ${key}:`, error)
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
      if (error.name === 'NoSuchKey' || error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null
      }
      throw error
    }
  }

  async checkConnection(): Promise<void> {
    try {
      // Пытаемся получить инфу о бакете
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.bucket }),
      )
    }
    catch (error: unknown) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        /* eslint-disable no-console */
        console.log(`⚠️ Bucket '${this.bucket}' not found. Attempting to create it...`)

        try {
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }))
          // Если бакет не найден (HTTP 404), пробуем его создать
          console.log(`✅ Bucket '${this.bucket}' created successfully.`)
        }
        catch (createError) {
          console.error(`❌ Failed to create bucket '${this.bucket}'. Check your credentials and permissions.`)
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
      console.error(`S3 ListDumpFolders Error for prefix ${prefix}:`, error)
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
      console.error(`S3 ListFilesInFolder Error for prefix ${prefix}:`, error)
      return []
    }
  }
}

export const s3Service = new S3Service()
