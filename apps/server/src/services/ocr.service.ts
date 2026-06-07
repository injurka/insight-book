import type { LlmConfig } from '../types'
import { LLM_API_URL } from '../config'
import { getOcrPrompt } from '../prompts'
import { AppError } from '../utils/errors'

export interface OcrBlock {
  id: number
  text: string
  x: number
  y: number
  w: number
  h: number
}

// ДОБАВЛЕН ПАРАМЕТР language: string
export async function recognizeMangaPage(base64Image: string, language: string, config: LlmConfig): Promise<OcrBlock[]> {
  if (!config.url)
    throw new AppError(500, 'API ключ / URL не настроен')

  let imageUrl = base64Image
  if (!base64Image.startsWith('data:image/')) {
    imageUrl = `data:image/jpeg;base64,${base64Image}`
  }

  const model = config.url === LLM_API_URL ? 'glm-ocr' : (config.model || 'glm-ocr')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.key) {
    headers.Authorization = `Bearer ${config.key}`
  }

  // Генерируем промпт с учетом языка
  const promptText = getOcrPrompt(language)

  const response = await fetch(`${config.url}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: promptText, // <--- Используем сгенерированный промпт
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(90000),
  })

  if (!response.ok) {
    throw new Error(`OCR API Error: ${await response.text()}`)
  }

  const data = await response.json() as any
  const blocks: OcrBlock[] = []

  const glmDetail = data.choices?.[0]?.glm_ocr_detail
  if (glmDetail && glmDetail.layout_details && glmDetail.layout_details[0]) {
    const layoutDetails = glmDetail.layout_details[0]

    layoutDetails.forEach((item: any, index: number) => {
      let text = item.content || ''
      text = text.replace(/```markdown/gi, '').replace(/```/g, '').trim()

      if (!text)
        return

      const [x1, y1, x2, y2] = item.bbox_2d || [0, 0, 0, 0]

      blocks.push({
        id: index,
        text,
        x: x1,
        y: y1,
        w: x2 - x1,
        h: y2 - y1,
      })
    })

    return blocks
  }

  const content = data.choices?.[0]?.message?.content
  if (content && content.trim() !== '') {
    const lines = content.split('\n')
      .map((line: string) => line.replace(/```markdown/gi, '').replace(/```/g, '').trim())
      .filter((line: string) => line.length > 0)

    return lines.map((line: string, index: number) => ({
      id: index,
      text: line,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
    }))
  }

  return []
}