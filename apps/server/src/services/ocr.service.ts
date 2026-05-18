import type { LlmConfig } from '../types'
import { LLM_API_URL } from '../config'
import { OCR_PROMPT } from '../prompts'
import { AppError } from '../utils/errors'

export interface OcrBlock {
  id: number
  text: string
  x: number
  y: number
  w: number
  h: number
}

export async function recognizeMangaPage(base64Image: string, config: LlmConfig): Promise<OcrBlock[]> {
  if (!config.url)
    throw new AppError(500, 'API ключ / URL не настроен')

  let imageUrl = base64Image
  if (!base64Image.startsWith('data:image/')) {
    imageUrl = `data:image/jpeg;base64,${base64Image}`
  }

  // Если используется дефолт, применяем оптимизированную модель glm-ocr
  // Если кастомный локальный LLM (Ollama, LM Studio), прокидываем модель пользователя
  const model = config.url === LLM_API_URL ? 'glm-ocr' : config.model

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.key) {
    headers.Authorization = `Bearer ${config.key}`
  }

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
              text: OCR_PROMPT,
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

  // 1. Ищем детальную структуру координат, которую отдает glm-ocr
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

  // 2. Fallback: Если детализации нет, пробуем распарсить обычный текст от стандартных моделей (GPT4-o, Llama-3.2-Vision)
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
