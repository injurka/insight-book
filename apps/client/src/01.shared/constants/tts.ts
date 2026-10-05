export const DEFAULT_TTS_VOICE = 'default'
export const TTS_AUDIO_CACHE_PREFIX = 'mp3_v1'

export function buildBookTtsCacheKey(bookId: number, voice: string, normalizedText: string): string {
  return `${TTS_AUDIO_CACHE_PREFIX}_${bookId}_${voice}_${normalizedText}`
}

export function buildDictionaryTtsCacheKey(lang: string, voice: string, normalizedText: string): string {
  return `${TTS_AUDIO_CACHE_PREFIX}_dict_${lang}_${voice}_${normalizedText}`
}

export const TTS_VOICE_OPTIONS = [
  { label: 'Default', value: DEFAULT_TTS_VOICE },
  { label: 'Kore (Firm)', value: 'Kore' },
  { label: 'Zephyr (Bright)', value: 'Zephyr' },
  { label: 'Puck (Upbeat)', value: 'Puck' },
  { label: 'Charon (Informative)', value: 'Charon' },
  { label: 'Fenrir (Excitable)', value: 'Fenrir' },
  { label: 'Leda (Youthful)', value: 'Leda' },
  { label: 'Orus (Firm)', value: 'Orus' },
  { label: 'Aoede (Breezy)', value: 'Aoede' },
] as const
