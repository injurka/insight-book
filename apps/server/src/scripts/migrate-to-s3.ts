import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { cancel, intro, isCancel, select, spinner } from '@clack/prompts'
import { eq, like, or } from 'drizzle-orm'
import { UPLOADS_PATH } from '~/config'
import { db } from '~/db'
import * as schema from '~/db/schema'
import { s3Service } from '~/services/s3.service'

// ──────────────────────── helpers ────────────────────────

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  }
  catch {
    return false
  }
}

/** Walk a directory and collect all file paths */
async function getFilesRecursively(dir: string): Promise<string[]> {
  const files: string[] = []
  if (!(await exists(dir)))
    return files

  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const res = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await getFilesRecursively(res)))
    }
    else {
      files.push(res)
    }
  }
  return files
}

/** Returns S3 key relative to uploads root: e.g. books/folder/page_1.jpg */
function toRelativeKey(absolutePath: string): string {
  const normalized = absolutePath.replace(/\\/g, '/')
  const uploadsPrefix = UPLOADS_PATH.replace(/\\/g, '/').replace(/\/$/, '')
  const idx = normalized.indexOf(uploadsPrefix)
  if (idx !== -1) {
    return normalized.substring(idx + uploadsPrefix.length).replace(/^\//, '')
  }
  // Fallback: look for 'books/' or 'covers/' or 'avatars/' segments
  const match = normalized.match(/(?:books|covers|avatars)\/.+/)
  return match ? match[0] : path.basename(normalized)
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.avif': 'image/avif',
  }
  return map[ext] ?? 'application/octet-stream'
}

// ──────────────────────── main ────────────────────────

async function main() {
  intro('🚀 Migration tool: Local uploads → S3')

  const s = spinner()

  // 1. Check S3 connection
  s.start('Checking S3 connection...')
  try {
    await s3Service.checkConnection()
    s.stop('✅ S3 connection OK.')
  }
  catch (err) {
    s.stop('❌ S3 connection failed!')
    console.error(err)
    process.exit(1)
  }

  const confirmed = await select({
    message: '⚠️  This will upload ALL local uploads to S3 and update the database. Proceed?',
    options: [
      { value: 'yes', label: 'Yes, start migration' },
      { value: 'no', label: 'No, cancel' },
    ],
  })
  if (isCancel(confirmed) || confirmed === 'no') {
    cancel('Cancelled.')
    process.exit(0)
  }

  // ── 2. Upload avatars ──────────────────────────────────
  {
    s.start('Uploading avatars...')
    const dir = path.join(UPLOADS_PATH, 'avatars')
    const files = await getFilesRecursively(dir)
    let ok = 0
    let fail = 0
    for (const f of files) {
      const key = toRelativeKey(f)
      try {
        const buf = await readFile(f)
        await s3Service.uploadFile(key, buf, getContentType(f))
        ok++
      }
      catch (err) {
        fail++
        console.error(`  ❌ ${key}:`, (err as Error).message)
      }
    }
    s.stop(`✅ Avatars: ${ok} uploaded${fail ? `, ${fail} failed` : ''}.`)
  }

  // ── 3. Upload covers ───────────────────────────────────
  {
    s.start('Uploading covers...')
    const dir = path.join(UPLOADS_PATH, 'covers')
    const files = await getFilesRecursively(dir)
    let ok = 0
    let fail = 0
    for (const f of files) {
      const key = toRelativeKey(f)
      try {
        const buf = await readFile(f)
        await s3Service.uploadFile(key, buf, getContentType(f))
        ok++
      }
      catch (err) {
        fail++
        console.error(`  ❌ ${key}:`, (err as Error).message)
      }
    }
    s.stop(`✅ Covers: ${ok} uploaded${fail ? `, ${fail} failed` : ''}.`)
  }

  // ── 4. Upload manga page images ────────────────────────
  {
    s.start('Uploading manga page images...')
    const dir = path.join(UPLOADS_PATH, 'books')
    const files = await getFilesRecursively(dir)
    // Only image files
    const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'])
    const imageFiles = files.filter(f => imageExts.has(path.extname(f).toLowerCase()))

    let ok = 0
    let fail = 0
    for (const f of imageFiles) {
      const key = toRelativeKey(f)
      try {
        const buf = await readFile(f)
        await s3Service.uploadFile(key, buf, getContentType(f))
        ok++
      }
      catch (err) {
        fail++
        console.error(`  ❌ ${key}:`, (err as Error).message)
      }
    }
    s.stop(`✅ Manga images: ${ok} uploaded${fail ? `, ${fail} failed` : ''}.`)
  }

  // ── 5. Update manga_pages table ────────────────────────
  {
    s.start('Updating manga_pages DB entries...')
    // Find rows that still have old-style paths (/uploads/... or /books/...)
    const allPages = await db.select({
      id: schema.mangaPages.id,
      imageUrl: schema.mangaPages.imageUrl,
    }).from(schema.mangaPages).where(
      or(
        like(schema.mangaPages.imageUrl, '/uploads/%'),
        like(schema.mangaPages.imageUrl, '/books/%'),
      ),
    )

    let updated = 0
    for (const page of allPages) {
      // Convert /uploads/books/folder/page_1.jpg → books/folder/page_1.jpg
      let relKey = page.imageUrl
      const uploadsIdx = relKey.indexOf('uploads/')
      if (uploadsIdx !== -1) {
        relKey = relKey.substring(uploadsIdx + 'uploads/'.length)
      }
      else {
        // strip leading slash
        relKey = relKey.replace(/^\//, '')
      }

      await db.update(schema.mangaPages)
        .set({ imageUrl: relKey })
        .where(eq(schema.mangaPages.id, page.id))
      updated++
    }
    s.stop(`✅ DB: ${updated} manga_pages rows updated.`)
  }

  console.log('\n🎉 Migration complete!')
  process.exit(0)
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
