import type { TtsResult } from '../types/tts'
import { isMp3Audio } from './audio'

export interface TtsCacheRow {
  textHash: string
  audioBlob: Buffer
  model: string
  provider: string
  requestedVoice: string
  voice: string
  createdAt: string
}

export function selectReusableTts(rows: TtsCacheRow[], requestedVoice: string): TtsCacheRow | undefined {
  return rows.find(row => (requestedVoice === 'default' || row.requestedVoice === requestedVoice || row.voice === requestedVoice)
    && isMp3Audio(Buffer.from(row.audioBlob)))
}

export function toTtsResult(row: TtsCacheRow): TtsResult {
  return {
    audioBase64: Buffer.from(row.audioBlob).toString('base64'),
    cache: {
      id: row.textHash,
      model: row.model,
      provider: row.provider,
      requestedVoice: row.requestedVoice,
      voice: row.voice,
      createdAt: row.createdAt,
    },
  }
}
