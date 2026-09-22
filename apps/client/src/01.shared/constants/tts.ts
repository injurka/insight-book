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
  { label: 'Long An Huan (Female)', value: 'longanhuan_v3.6' },
  { label: 'Long An Feng Yue (Female)', value: 'longanfengyue' },
  { label: 'Long An Yuan Fei (Female)', value: 'longanyuanfei' },
  { label: 'Long An Ling Xi (Female)', value: 'longanlingxi' },
  { label: 'Mary (Female, British)', value: 'loongmary' },
  { label: 'Eva (Female, American)', value: 'loongeva_v3.6' },
  { label: 'John (Male, American)', value: 'loongjohn' },
  { label: 'Long Chuan Shu (Male)', value: 'longchuanshu_v3.6' },
] as const
