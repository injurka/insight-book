import { writeFileSync } from 'node:fs'

export async function downloadImageNode(url: string, savePath: string, referer: string, retries = 3): Promise<void> {
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
      writeFileSync(savePath, Buffer.from(arrayBuffer))
      return
    } catch (error) {
      if (i === retries - 1) throw new Error(`Ошибка скачивания: ${url} (${error})`)
      // Экспоненциальная задержка перед следующей попыткой
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
