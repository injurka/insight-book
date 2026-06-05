import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

export async function downloadImageNode(url: string, savePathWithoutExt: string, referer: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Referer': referer,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Проверяем реальный формат изображения с помощью sharp
      const metadata = await sharp(buffer).metadata()
      const format = metadata.format?.toLowerCase()

      let finalBuffer = buffer
      let ext = format === 'png' ? '.png' : '.jpg'

      // Если формат не поддерживается (например, webp, avif, heif), конвертируем в JPEG
      if (format && !['jpeg', 'jpg', 'png', 'pdf'].includes(format)) {
        finalBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer()
        ext = '.jpg'
      }

      const finalPath = `${savePathWithoutExt}${ext}`
      writeFileSync(finalPath, finalBuffer)
      return finalPath

    } catch (error) {
      if (i === retries - 1) throw new Error(`Ошибка скачивания: ${url} (${error})`)
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  throw new Error(`Не удалось скачать: ${url}`)
}
