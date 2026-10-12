import { z } from 'zod'

export const TtsCacheMetadataSchema = z.object({
  id: z.string(),
  model: z.string(),
  provider: z.string(),
  requestedVoice: z.string().default('unknown'),
  voice: z.string(),
  createdAt: z.string(),
})

export const TtsResultSchema = z.object({
  audioBase64: z.string(),
  // Older servers omit this; new TTS responses explicitly identify MP3 audio.
  mimeType: z.literal('audio/mpeg').optional(),
  // Keep old API responses usable during a rolling deployment.
  cache: TtsCacheMetadataSchema.optional(),
})

export type TtsCacheMetadata = z.infer<typeof TtsCacheMetadataSchema>
export type TtsResult = z.infer<typeof TtsResultSchema>
