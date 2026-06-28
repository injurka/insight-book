import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// Ищем конфиг в примонтированной папке Docker (если это деплой)
let defaultPath = path.resolve(process.cwd(), 'configs/ai-config.json')

// Если локальная разработка в монорепе (apps/server -> ../../configs)
if (!existsSync(defaultPath)) {
  defaultPath = path.resolve(process.cwd(), '../../configs/ai-config.json')
}

export const CONFIG_PATH = process.env.AI_CONFIG_PATH || defaultPath

// Логируем один раз при старте сервера
if (existsSync(CONFIG_PATH)) {
  // eslint-disable-next-line no-console
  console.log(`🤖 AI Config loaded from: ${CONFIG_PATH}`)
}
else {
  // eslint-disable-next-line no-console
  console.log(`⚠️ AI Config file not found at ${CONFIG_PATH}, using defaults/env.`)
}

export interface ModelPrice {
  input: number
  output: number
}

export function getAiConfig() {
  let fileConfig: any = {}
  try {
    if (existsSync(CONFIG_PATH)) {
      fileConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    }
  }
  catch (e) {
    console.error('[AI Config] Failed to read config file:', e)
  }

  const llmUrl = fileConfig.llm?.url || process.env.LLM_API_URL || 'https://aihubmix.com/v1'
  const llmKey = fileConfig.llm?.key || process.env.LLM_API_KEY || ''

  return {
    llm: {
      url: llmUrl,
      key: llmKey,
      model: fileConfig.llm?.model || process.env.LLM_MODEL || 'gemini-3.1-flash-lite',
      fallbackModel: fileConfig.llm?.fallbackModel || process.env.LLM_FALLBACK_MODEL || 'gpt-4o-mini',
    },
    tts: {
      url: fileConfig.tts?.url || process.env.TTS_API_URL || llmUrl,
      model: fileConfig.tts?.model || process.env.TTS_MODEL || 'gemini-2.5-flash-preview-tts',
      fallbackModel: fileConfig.tts?.fallbackModel || process.env.TTS_FALLBACK_MODEL || 'gpt-4o-mini-tts',
      key: fileConfig.tts?.key || process.env.TTS_API_KEY || llmKey,
    },
    stt: {
      url: fileConfig.stt?.url || process.env.STT_API_URL || llmUrl,
      model: fileConfig.stt?.model || process.env.STT_MODEL || 'whisper-large-v3',
      fallbackModel: fileConfig.stt?.fallbackModel || process.env.STT_FALLBACK_MODEL || 'whisper-large-v3-turbo',
      key: fileConfig.stt?.key || process.env.STT_API_KEY || llmKey,
    },
    ocr: {
      url: fileConfig.ocr?.url || process.env.OCR_API_URL || llmUrl,
      key: fileConfig.ocr?.key || process.env.OCR_API_KEY || llmKey,
      model: fileConfig.ocr?.model || process.env.OCR_MODEL || 'glm-ocr',
      refinementModel: fileConfig.ocr?.refinementModel || process.env.OCR_REFINEMENT_MODEL || 'gemini-3.1-flash-lite',
    },
    pricing: (fileConfig.pricing || {}) as Record<string, ModelPrice>,
  }
}
