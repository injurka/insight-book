import type { TtsCacheMetadata } from '~/01.shared/types/schemas/tts.schema'
import { z } from 'zod'
import { TtsCacheMetadataSchema } from '~/01.shared/types/schemas/tts.schema'

export const StoredTtsSchema = z.union([
  z.string().transform(audioBase64 => ({ audioBase64, cache: undefined })),
  z.object({ audioBase64: z.string(), cache: TtsCacheMetadataSchema.optional() }),
])

export function unknownTtsMetadata(): TtsCacheMetadata {
  return {
    id: 'unknown',
    model: 'unknown',
    provider: 'unknown',
    voice: 'unknown',
    requestedVoice: 'unknown',
    createdAt: '',
  }
}

export function decodeTtsMetadata(value: string | null): TtsCacheMetadata {
  if (value) {
    try {
      return TtsCacheMetadataSchema.parse(JSON.parse(decodeURIComponent(value)))
    }
    catch { }
  }

  return unknownTtsMetadata()
}

// Default can reuse any timbre, including keys written before the Gemini migration.
// Explicit voices keep their own cache identity. Book/language scopes never mix.
export function isReusableLocalTtsKey(candidate: string, requested: string): boolean {
  if (candidate === requested)
    return true

  // Pre-MP3 namespaces may contain Ogg/Opus mislabeled as MPEG; keep them stored,
  // but do not revive them on devices that require the normalized MP3 contract.
  if (!/^(?:mp3_v1|mp3_gemini_3_8_v1)_/.test(candidate))
    return false

  const stripPrefix = (key: string) => key.replace(/^(?:mp3_v1|mp3_gemini_3_8_v1)_/, '')
  const target = stripPrefix(requested).match(/^(dict_[^_]+|\d+)_default_(.+)$/s)

  if (!target)
    return stripPrefix(candidate) === stripPrefix(requested)

  const key = stripPrefix(candidate)
  const prefix = `${target[1]}_`
  const suffix = `_${target[2]}`

  if (!key.startsWith(prefix) || !key.endsWith(suffix))
    return false

  const voice = key.slice(prefix.length, -suffix.length)

  // Text can itself contain underscores; limit the middle segment to a voice id.
  return /^[a-z][a-z\d.-]*(?:_v\d+(?:\.\d+)*)?$/i.test(voice)
}

export function ttsBase64ToBlob(audioBase64: string): Blob {
  const binary = window.atob(audioBase64)
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))

  return new Blob([bytes], { type: 'audio/mpeg' })
}
