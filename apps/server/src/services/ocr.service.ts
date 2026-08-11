import type { GlmOcrLayoutDetail, LlmConfig, OpenAiMessageContent, OpenAiResponse } from '../types'
import sharp from 'sharp'
import { ERROR_CODES } from '../constants/error-codes'
import { getOcrPrompt, getOcrRefinementPrompt } from '../prompts'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'
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
  const apiUrl = config.ocrUrl || config.url
  const apiKey = config.ocrKey || config.key
  const model = config.ocrModel!

  if (!apiUrl)
    throw new AppError(500, ERROR_CODES.OCR.NOT_CONFIGURED, 'OCR API URL not configured')

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

  const data = await response.json() as OpenAiResponse
  const promptTokens = data.usage?.prompt_tokens || 0
  const completionTokens = data.usage?.completion_tokens || 0

  const inputTextForLog = JSON.stringify({ prompt: promptText, imageBase64: `${imageUrl.substring(0, 100)}...[TRUNCATED]` }, null, 2)
  const outputTextForLog = JSON.stringify(data, null, 2)
  trackTokenUsage(userId, 'ocr_layout', model, promptTokens, completionTokens, inputTextForLog, outputTextForLog)

  const blocks: OcrBlock[] = []
  const glmDetail = data.choices?.[0]?.glm_ocr_detail

  if (glmDetail && glmDetail.layout_details && glmDetail.layout_details[0]) {
    const layoutDetails = glmDetail.layout_details[0]

    layoutDetails.forEach((item: GlmOcrLayoutDetail, index: number) => {
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

    const contentArray: OpenAiMessageContent[] = [
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

    const apiUrl = config.ocrUrl || config.url
    const apiKey = config.ocrKey || config.key
    const model = config.ocrRefinementModel!

    if (!apiUrl)
      throw new AppError(500, ERROR_CODES.OCR.NOT_CONFIGURED, 'OCR Refinement API URL not configured')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }

    const messages = [
      {
        role: 'user',
        content: contentArray,
      },
    ]

    let response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(120000),
    })

    if (response.ok) {
      let data = await response.json() as OpenAiResponse
      const content = data.choices?.[0]?.message?.content || ''

      const promptTokens = data.usage?.prompt_tokens || 0
      const completionTokens = data.usage?.completion_tokens || 0

      const safeInput = contentArray.map((c: OpenAiMessageContent) => {
        if (c.type === 'image_url' && c.image_url)
          return { type: 'image_url', image_url: { url: `${c.image_url.url.substring(0, 100)}...[TRUNCATED]` } }
        return c
      })
      const inputTextForLog = JSON.stringify(safeInput, null, 2)
      trackTokenUsage(userId, 'ocr_refine', model, promptTokens, completionTokens, inputTextForLog, content)

      let cleanJson = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

      try {
        const refinedTexts = JSON.parse(cleanJson)
        if (!Array.isArray(refinedTexts)) {
          throw new TypeError('Expected an array of strings')
        }
        if (refinedTexts.length !== validBlocks.length) {
          throw new Error(`Expected exactly ${validBlocks.length} elements, but got ${refinedTexts.length}`)
        }
        for (let i = 0; i < validBlocks.length; i++) {
          validBlocks[i].text = cleanOcrText(refinedTexts[i]) || validBlocks[i].text
        }
      }
      catch (parseError: unknown) {
        const err = parseError as Error
        logger.warn(`[OCR Refinement] First attempt failed to parse JSON. Error: ${err.message || err}. Retrying...`)

        // Выполняем ровно 1 повторный запрос с инструкцией об ошибке
        const retryMessages = [
          ...messages,
          { role: 'assistant', content },
          { role: 'user', content: `Your previous response was not valid JSON or did not contain the correct number of items. Please fix it. Error details: ${err.message || err}. Make sure to output ONLY valid JSON.` },
        ]

        response = await fetch(`${apiUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: retryMessages,
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(120000),
        })

        if (response.ok) {
          data = await response.json() as OpenAiResponse
          const retryContent = data.choices?.[0]?.message?.content || ''
          const retryPromptTokens = data.usage?.prompt_tokens || 0
          const retryCompletionTokens = data.usage?.completion_tokens || 0

          const retryInputTextForLog = JSON.stringify([
            ...safeInput,
            { role: 'assistant', content },
            { role: 'user', content: 'Your previous response was not valid JSON or did not contain the correct number of items...' },
          ], null, 2)

          trackTokenUsage(userId, 'ocr_refine', model, retryPromptTokens, retryCompletionTokens, retryInputTextForLog, retryContent)

          cleanJson = retryContent.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
          try {
            const refinedTexts = JSON.parse(cleanJson)
            if (Array.isArray(refinedTexts) && refinedTexts.length === validBlocks.length) {
              for (let i = 0; i < validBlocks.length; i++) {
                validBlocks[i].text = cleanOcrText(refinedTexts[i]) || validBlocks[i].text
              }
            }
            else {
              logger.error(refinedTexts?.length, '[OCR Refinement] Second attempt failed validation. Length:')
            }
          }
          catch (retryParseError) {
            logger.error({ cleanJson, err: retryParseError }, '[OCR Refinement] Second attempt failed to parse JSON response:')
          }
        }
      }
    }
  }
  catch (error) {
    logger.error(error, '[OCR Refinement] Failed to refine OCR text:')
  }

  return blocks
}
