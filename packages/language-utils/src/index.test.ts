import { describe, expect, test } from 'bun:test'
import { getTtsTextMaxLength, isTtsTextWithinLimit } from './index'

describe('TTS text limits', () => {
  test('allows up to 350 characters for non-Han text', () => {
    expect(getTtsTextMaxLength('English text')).toBe(350)
    expect(isTtsTextWithinLimit('a'.repeat(350))).toBe(true)
    expect(isTtsTextWithinLimit('a'.repeat(351))).toBe(false)
  })

  test('allows up to 100 characters for text containing Han characters', () => {
    expect(getTtsTextMaxLength('中文')).toBe(100)
    expect(isTtsTextWithinLimit('中'.repeat(100))).toBe(true)
    expect(isTtsTextWithinLimit('中'.repeat(101))).toBe(false)
  })
})
