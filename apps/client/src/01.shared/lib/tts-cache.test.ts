import { describe, expect, it } from 'vitest'
import { decodeTtsMetadata, isReusableLocalTtsKey, StoredTtsSchema } from './tts-cache'

const metadata = {
  id: 'hash',
  model: 'tts-1',
  provider: 'aihubmix.com',
  voice: 'alloy',
  requestedVoice: 'Kore',
  createdAt: '2026-10-05T00:00:00Z',
}

describe('offline TTS compatibility', () => {
  it('accepts legacy base64 and preserves provenance in new IndexedDB records', () => {
    expect(StoredTtsSchema.parse('QUJD').audioBase64).toBe('QUJD')
    expect(StoredTtsSchema.parse({ audioBase64: 'QUJD', cache: metadata }).cache).toEqual(metadata)
    expect(decodeTtsMetadata(null).model).toBe('unknown')
    expect(decodeTtsMetadata('invalid').model).toBe('unknown')
    expect(decodeTtsMetadata(encodeURIComponent(JSON.stringify(metadata)))).toEqual(metadata)
  })

  it('default finds old Qwen and Gemini timbres in the same book or dictionary', () => {
    const target = 'mp3_v1_1_default_hello_world.'
    expect(isReusableLocalTtsKey('mp3_v1_1_longanhuan_v3.6_hello_world.', target)).toBe(true)
    expect(isReusableLocalTtsKey('mp3_gemini_3_8_v1_1_Kore_hello_world.', target)).toBe(true)
    expect(isReusableLocalTtsKey('qwen_1_longanhuan_v3.6_hello_world.', target)).toBe(false)
    expect(isReusableLocalTtsKey('mp3_v1_dict_en_Kore_hello.', 'mp3_v1_dict_en_default_hello.')).toBe(true)
  })

  it('never reuses another book, language, text or explicitly selected voice', () => {
    expect(isReusableLocalTtsKey('mp3_v1_2_Kore_hello.', 'mp3_v1_1_default_hello.')).toBe(false)
    expect(isReusableLocalTtsKey('mp3_v1_dict_ru_Kore_hello.', 'mp3_v1_dict_en_default_hello.')).toBe(false)
    expect(isReusableLocalTtsKey('mp3_v1_1_Kore_hello_world.', 'mp3_v1_1_default_world.')).toBe(false)
    expect(isReusableLocalTtsKey('mp3_v1_1_Puck_hello.', 'mp3_v1_1_Kore_hello.')).toBe(false)
  })
})
