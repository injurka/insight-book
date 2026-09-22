import { describe, expect, it } from 'bun:test'
import { convertToMp3, isMp3Audio } from './audio'

function createPcmWav(): Buffer {
  const sampleRate = 8_000
  const samples = Buffer.alloc(sampleRate / 10 * 2)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + samples.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(samples.length, 40)

  return Buffer.concat([header, samples])
}

describe('isMp3Audio', () => {
  it('recognizes ID3 and MPEG frame headers', () => {
    expect(isMp3Audio(Buffer.from([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0, 0xFF, 0xFB, 0x90, 0x64]))).toBe(true)
    expect(isMp3Audio(Buffer.from([0xFF, 0xFB, 0x90, 0x64]))).toBe(true)
  })

  it('rejects Ogg and WAV containers', () => {
    expect(isMp3Audio(Buffer.from('OggSaudio'))).toBe(false)
    expect(isMp3Audio(Buffer.from('RIFFaudio'))).toBe(false)
    expect(isMp3Audio(Buffer.from('ID3audio'))).toBe(false)
    expect(isMp3Audio(Buffer.from([0xFF, 0xE0, 0, 0]))).toBe(false)
  })

  it('transcodes WAV data to a recognized MP3 stream', async () => {
    const mp3 = await convertToMp3(createPcmWav())

    expect(isMp3Audio(mp3)).toBe(true)
    expect(mp3.length).toBeGreaterThan(0)
  })

  it('rejects empty input instead of caching an invalid file', async () => {
    expect(convertToMp3(Buffer.alloc(0))).rejects.toThrow('empty audio buffer')
  })
})
