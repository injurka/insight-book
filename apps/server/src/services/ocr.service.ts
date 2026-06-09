import type { LlmConfig } from '../types'
import sharp from 'sharp'
import {
  LLM_API_KEY,
  LLM_API_URL,
  LLM_MODEL,
  OCR_API_KEY,
  OCR_API_URL,
  OCR_MODEL,
  OCR_REFINEMENT_MODEL,
} from '../config'
import { getOcrPrompt, getOcrRefinementPrompt } from '../prompts'
import { AppError } from '../utils/errors'
import { checkTokenLimit } from './limits.service'
import { trackTokenUsage } from './token.service'

export interface OcrBlock {
  id: number
  text: string
  x: number
  y: number
  w: number
  h: number
}

function cleanOcrText(rawText: string): string {
  let text = rawText || ''
  text = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '')
  text = text.replace(/<[^>]*>/g, '')
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2')
  return text.trim()
}

export async function recognizeMangaPage(userId: number, base64Image: string, language: string, textDirection: string | undefined, config: LlmConfig): Promise<OcrBlock[]> {
  await checkTokenLimit(userId)

  let imageUrl = base64Image
  if (!base64Image.startsWith('data:image/')) {
    imageUrl = `data:image/jpeg;base64,${base64Image}`
  }

  const blocks = await getOcrLayout(userId, imageUrl, language, textDirection, config)

  if (blocks.length > 0 && blocks.some(b => b.w > 0 && b.h > 0)) {
    return await refineOcrText(userId, base64Image, blocks, language, textDirection, config)
  }

  return blocks
}

async function getOcrLayout(userId: number, imageUrl: string, language: string, textDirection: string | undefined, config: LlmConfig): Promise<OcrBlock[]> {
  const apiUrl = config.url === LLM_API_URL ? OCR_API_URL : config.url
  const apiKey = config.key === LLM_API_KEY ? OCR_API_KEY : config.key
  const model = config.model === LLM_MODEL ? OCR_MODEL : (config.model || OCR_MODEL)

  if (!apiUrl)
    throw new AppError(500, 'API URL для OCR не настроен')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  const promptText = getOcrPrompt(language, textDirection)

  const response = await fetch(`${apiUrl}/chat/completions`, {
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
  const promptTokens = data.usage?.prompt_tokens || 0
  const completionTokens = data.usage?.completion_tokens || 0
  trackTokenUsage(userId, 'ocr_layout', model, promptTokens, completionTokens)

  const blocks: OcrBlock[] = []
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

    return blocks
  }

  const content = data.choices?.[0]?.message?.content
  if (content && content.trim() !== '') {
    const lines = content.split('\n')
      .map((line: string) => cleanOcrText(line))
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

async function refineOcrText(userId: number, base64Image: string, blocks: OcrBlock[], language: string, textDirection: string | undefined, config: LlmConfig): Promise<OcrBlock[]> {
  const validBlocks = blocks.filter(b => b.w > 0 && b.h > 0)
  if (validBlocks.length === 0)
    return blocks

  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '')
  const imageBuffer = Buffer.from(base64Data, 'base64')

  try {
    const image = sharp(imageBuffer)
    const metadata = await image.metadata()

    if (!metadata.width || !metadata.height)
      return blocks

    const contentArray: any[] = [
      {
        type: 'text',
        text: getOcrRefinementPrompt(language, validBlocks.length, textDirection),
      },
    ]

    const padding = 15

    for (const block of validBlocks) {
      const left = Math.max(0, Math.floor(block.x) - padding)
      const top = Math.max(0, Math.floor(block.y) - padding)
      const right = Math.min(metadata.width, Math.ceil(block.x + block.w) + padding)
      const bottom = Math.min(metadata.height, Math.ceil(block.y + block.h) + padding)
      const width = right - left
      const height = bottom - top

      if (width > 0 && height > 0) {
        const cropBuffer = await sharp(imageBuffer)
          .extract({ left, top, width, height })
          .jpeg({ quality: 90 })
          .toBuffer()

        contentArray.push({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${cropBuffer.toString('base64')}`,
          },
        })
      }
    }

    const apiUrl = config.url
    const apiKey = config.key
    const model = config.model === LLM_MODEL ? OCR_REFINEMENT_MODEL : (config.model || OCR_REFINEMENT_MODEL)

    if (!apiUrl)
      throw new AppError(500, 'API URL для OCR Refinement не настроен')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: contentArray,
          },
        ],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(120000),
    })

    if (response.ok) {
      const data = await response.json() as any
      const content = data.choices?.[0]?.message?.content || ''

      const promptTokens = data.usage?.prompt_tokens || 0
      const completionTokens = data.usage?.completion_tokens || 0
      trackTokenUsage(userId, 'ocr_refine', model, promptTokens, completionTokens)

      const cleanJson = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

      try {
        const refinedTexts = JSON.parse(cleanJson)
        if (Array.isArray(refinedTexts) && refinedTexts.length === validBlocks.length) {
          for (let i = 0; i < validBlocks.length; i++) {
            validBlocks[i].text = cleanOcrText(refinedTexts[i]) || validBlocks[i].text
          }
        }
      }
      catch (parseError) {
        console.error('[OCR Refinement] Failed to parse JSON response:', cleanJson, parseError)
      }
    }
  }
  catch (error) {
    console.error('[OCR Refinement] Failed to refine OCR text:', error)
  }

  return blocks
}
