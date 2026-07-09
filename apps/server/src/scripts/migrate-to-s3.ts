import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { cancel, intro, isCancel, select, spinner } from '@clack/prompts'
import { eq } from 'drizzle-orm'
import { UPLOADS_PATH } from '~/config'
import { db } from '~/db'
import * as schema from '~/db/schema'
import { s3Service } from '~/services/s3.service'

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  }
  catch {
    return false
  }
}

async function getFilesRecursively(dir: string): Promise<string[]> {
  const files: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const res = path.resolve(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...(await getFilesRecursively(res)))
      }
      else {
        files.push(res)
      }
    }
  }
  catch {
    // Ignore if directory doesn't exist
  }
  return files
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}

async function main() {
  intro('🚀 Migration script: Local storage to S3')

  const s = spinner()

  // 1. Check S3 connection
  s.start('Checking S3 connection...')
  try {
    await s3Service.checkConnection()
    s.stop('✅ S3 connection verified successfully.')
  }
  catch (err) {
    s.stop('❌ S3 connection failed!')
    console.error(err)
    process.exit(1)
  }

  // Confirm migration
  const confirmed = await select({
    message: 'Do you want to start the migration of local uploads to S3?',
    options: [
      { value: 'yes', label: 'Yes, start migration' },
      { value: 'no', label: 'No, cancel' },
    ],
  })

  if (isCancel(confirmed) || confirmed === 'no') {
    cancel('Migration cancelled.')
    process.exit(0)
  }

  const avatarsDir = path.join(UPLOADS_PATH, 'avatars')
  const coversDir = path.join(UPLOADS_PATH, 'covers')

  // --- 2. Migrate Avatars ---
  s.start('Migrating user avatars...')
  const avatarFiles = await getFilesRecursively(avatarsDir)
  let avatarCount = 0
  for (const file of avatarFiles) {
    const filename = path.basename(file)
    const s3Key = `avatars/${filename}`
    try {
      const buffer = await readFile(file)
      await s3Service.uploadFile(s3Key, buffer, getContentType(file))
      avatarCount++
    }
    catch (err) {
      console.error(`❌ Failed to upload avatar ${filename}:`, err)
    }
  }
  s.stop(`✅ Avatars migration complete. Uploaded ${avatarCount} files.`)

  // --- 3. Migrate Covers ---
  s.start('Migrating book covers...')
  const coverFiles = await getFilesRecursively(coversDir)
  let coverCount = 0
  for (const file of coverFiles) {
    const filename = path.basename(file)
    const s3Key = `covers/${filename}`
    try {
      const buffer = await readFile(file)
      await s3Service.uploadFile(s3Key, buffer, getContentType(file))
      coverCount++
    }
    catch (err) {
      console.error(`❌ Failed to upload cover ${filename}:`, err)
    }
  }
  s.stop(`✅ Covers migration complete. Uploaded ${coverCount} files.`)

  // --- 4. Migrate Manga Pages and update DB ---
  s.start('Migrating manga pages & updating database entries...')
  let mangaPageCount = 0
  let dbUpdatedCount = 0

  try {
    const allMangaPages = await db.select().from(schema.mangaPages)

    for (const page of allMangaPages) {
      const { id, imageUrl } = page
      // Check if it's local
      const isLocal = imageUrl.includes('uploads/books/') || imageUrl.startsWith('/')
      if (!isLocal) {
        continue
      }

      // Extract relative path from 'uploads/'
      let relativeKey = ''
      const uploadIndex = imageUrl.indexOf('uploads/')
      if (uploadIndex !== -1) {
        relativeKey = imageUrl.substring(uploadIndex + 'uploads/'.length)
      }
      else {
        const booksIndex = imageUrl.indexOf('books/')
        if (booksIndex !== -1) {
          relativeKey = imageUrl.substring(booksIndex)
        }
      }

      if (!relativeKey) {
        console.warn(`⚠️ Could not parse relative S3 key from imageUrl: ${imageUrl}`)
        continue
      }

      // Resolve local file path
      let localPath = imageUrl
      if (!path.isAbsolute(localPath)) {
        localPath = path.resolve(UPLOADS_PATH, relativeKey)
      }

      if (await exists(localPath)) {
        try {
          const buffer = await readFile(localPath)
          await s3Service.uploadFile(relativeKey, buffer, getContentType(localPath))
          mangaPageCount++
        }
        catch (err) {
          console.error(`❌ Failed to upload manga page ${localPath}:`, err)
        }
      }
      else {
        console.warn(`⚠️ Local file not found for manga page ${id}: ${localPath}`)
      }

      // Update imageUrl database value to point to relative S3 key
      await db.update(schema.mangaPages)
        .set({ imageUrl: relativeKey })
        .where(eq(schema.mangaPages.id, id))
      dbUpdatedCount++
    }
    s.stop(`✅ Manga pages migration complete. Uploaded ${mangaPageCount} files, updated ${dbUpdatedCount} database entries.`)
  }
  catch (err) {
    s.stop('❌ Error during manga pages migration!')
    console.error(err)
  }

  console.log('\n🎉 Migration process finished successfully!')
  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌ Fatal Migration Error:', err)
  process.exit(1)
})
