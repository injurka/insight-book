export interface TtsCacheMetadata {
  id: string
  model: string
  provider: string
  requestedVoice: string
  voice: string
  createdAt: string
}

export interface TtsResult {
  audioBase64: string
  cache: TtsCacheMetadata
}
