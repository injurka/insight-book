import type { LlmConfig } from '../types'
import { LLM_API_URL } from '../config'
import { getLangName, getOcrPrompt } from '../prompts'
import { AppError } from '../utils/errors'
import sharp from 'sharp'

export interface OcrBlock {
  id: number
  text: string
  x: number
  y: number
  w: number
  h: number
}

// Агрессивная очистка текста от мусора, генерируемого LLM
function cleanOcrText(rawText: string): string {
  let text = rawText || ''
  // Убираем блоки markdown вида ```markdown ... ```
  text = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '')
  // Убираем случайные html/xml теги (например <p>, <box>, <text>)
  text = text.replace(/<[^>]*>/g, '')
  // Убираем маркдаун выделения (**, __), если они появились
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2')
  // Убираем лишние пробелы по краям
  return text.trim()
}

export async function recognizeMangaPage(base64Image: string, language: string, textDirection: string | undefined, config: LlmConfig): Promise<OcrBlock[]> {
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

  const promptText = getOcrPrompt(language, textDirection)

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
              text: promptText,
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
  let blocks: OcrBlock[] = []

  const glmDetail = data.choices?.[0]?.glm_ocr_detail
  if (glmDetail && glmDetail.layout_details && glmDetail.layout_details[0]) {
    const layoutDetails = glmDetail.layout_details[0]

    layoutDetails.forEach((item: any, index: number) => {
      const text = cleanOcrText(item.content)

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
  } else {
    const content = data.choices?.[0]?.message?.content
    if (content && content.trim() !== '') {
      const lines = content.split('\n')
        .map((line: string) => cleanOcrText(line))
        .filter((line: string) => line.length > 0)

      blocks = lines.map((line: string, index: number) => ({
        id: index,
        text: line,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
      }))
    }
  }

  // 2. ВТОРОЙ ПРОХОД: Уточняем текст вырезанных фрагментов с помощью основной LLM (например, gemini-3.1-flash-lite)
  if (blocks.length > 0 && blocks.some(b => b.w > 0 && b.h > 0)) {
    try {
      blocks = await refineOcrBlocksText(base64Image, blocks, language, textDirection, config)
    } catch (e: any) {
      console.warn('[OCR Refinement] Failed to refine text:', e.message)
      // При ошибке рефайна просто возвращаем исходные блоки (fallback)
    }
  }

  return blocks
}

async function refineOcrBlocksText(base64Image: string, blocks: OcrBlock[], language: string, textDirection: string | undefined, config: LlmConfig): Promise<OcrBlock[]> {
  const imageBuffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  const metadata = await sharp(imageBuffer).metadata()
  const imgWidth = metadata.width || 0
  const imgHeight = metadata.height || 0

  if (imgWidth === 0 || imgHeight === 0) return blocks

  const contentParts: any[] = []

  let layoutHint = 'Read bubbles and text in the standard horizontal order: left-to-right, top-to-bottom.'
  if (textDirection === 'v_rtl') {
    layoutHint = 'Pay close attention to VERTICAL text. Read columns from top-to-bottom, and proceed strictly from RIGHT to LEFT.'
  } else if (textDirection === 'rtl') {
    layoutHint = 'Read bubbles and text in horizontal right-to-left order.'
  } else if (language === 'ja' || language === 'zh') {
    layoutHint = 'Pay close attention to VERTICAL text which is standard for manga/manhua. Read vertical bubbles correctly from top-to-bottom, right-to-left. If the layout is clearly left-to-right, adjust your reading order accordingly. Also parse any horizontal text if present.'
  }

  contentParts.push({
    type: 'text',
    text: `Here are ${blocks.length} cropped text bubbles from a manga page.
The primary language of the text is ${getLangName(language)}.
${layoutHint}

CRITICAL CONSTRAINTS:
1. Extract the text for EACH image in the EXACT same order they are provided.
2. NO TRANSLATIONS. Output exactly the original text.
3. DO NOT describe the images.
4. RETURN STRICTLY A JSON OBJECT WITH A SINGLE KEY "texts" CONTAINING AN ARRAY OF STRINGS. Example: { "texts": ["text from image 1", "text from image 2"] }
5. Do not include markdown formatting like \`\`\`json or explanations. Just the JSON object.`
  })

  let validImageCount = 0

  for (const block of blocks) {
    const left = Math.max(0, Math.min(Math.round(block.x), imgWidth - 1))
    const top = Math.max(0, Math.min(Math.round(block.y), imgHeight - 1))
    const width = Math.round(block.w)
    const height = Math.round(block.h)

    // Небольшой padding (отступ), чтобы LLM лучше видела контекст и края иероглифов
    const padding = 8
    const pLeft = Math.max(0, left - padding)
    const pTop = Math.max(0, top - padding)
    const pRight = Math.min(imgWidth, left + width + padding)
    const pBottom = Math.min(imgHeight, top + height + padding)

    const pWidth = pRight - pLeft
    const pHeight = pBottom - pTop

    if (pWidth <= 0 || pHeight <= 0) {
      contentParts.push({
        type: 'text',
        text: '[Empty or Invalid Block Image]'
      })
      continue
    }

    try {
      const croppedBuffer = await sharp(imageBuffer)
        .extract({ left: pLeft, top: pTop, width: pWidth, height: pHeight })
        .jpeg({ quality: 90 })
        .toBuffer()

      const croppedBase64 = croppedBuffer.toString('base64')
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${croppedBase64}`
        }
      })
      validImageCount++
    } catch (e) {
      contentParts.push({
        type: 'text',
        text: '[Error Extracting Block Image]'
      })
    }
  }

  if (validImageCount === 0) return blocks

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
      model: config.model,
      messages: [
        {
          role: 'user',
          content: contentParts,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    }),
    signal: AbortSignal.timeout(120000),
  })

  if (!response.ok) {
    throw new Error(`Refinement API Error: ${await response.text()}`)
  }

  const data = await response.json() as any
  const content = data.choices?.[0]?.message?.content

  if (content) {
    const cleanJson = content.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim()
    try {
      const parsed = JSON.parse(cleanJson)
      const texts = parsed.texts

      if (Array.isArray(texts)) {
        for (let i = 0; i < Math.min(blocks.length, texts.length); i++) {
          const refinedText = cleanOcrText(texts[i] || '')
          if (refinedText) {
            blocks[i].text = refinedText
          }
        }
      }
    } catch (parseError) {
      console.warn('[OCR Refinement] Failed to parse LLM response as JSON', parseError, content)
    }
  }

  return blocks
}
