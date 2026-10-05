import { describe, expect, test } from 'bun:test'
import { selectReusableTts, toTtsResult } from './tts-cache'

const audioBlob = Buffer.from([0xFF, 0xFB, 0x90, 0x64])
const legacy = {
  textHash: 'legacy',
  audioBlob,
  model: 'unknown',
  provider: 'unknown',
  voice: 'unknown',
  requestedVoice: 'unknown',
  createdAt: '2026-01-01',
}

const fallback = {
  ...legacy,
  textHash: 'fallback',
  model: 'tts-1',
  provider: 'aihubmix.com',
  voice: 'alloy',
  requestedVoice: 'Kore',
}

describe('reusable TTS cache', () => {
  test('default preserves legacy audio with unknown provenance', () => {
    expect(selectReusableTts([legacy, fallback], 'default')).toBe(legacy)
    expect(toTtsResult(legacy).cache.model).toBe('unknown')
  })

  test('explicit voice reuses its fallback while reporting the actual model and voice', () => {
    expect(selectReusableTts([legacy, fallback], 'Kore')).toBe(fallback)
    expect(toTtsResult(fallback).cache).toMatchObject({ model: 'tts-1', voice: 'alloy', requestedVoice: 'Kore' })
    expect(selectReusableTts([fallback], 'Puck')).toBeUndefined()
  })

  test('corrupt audio does not prevent reuse of a later valid entry', () => {
    expect(selectReusableTts([{ ...legacy, audioBlob: Buffer.from('invalid') }, fallback], 'default')).toBe(fallback)
  })
})
