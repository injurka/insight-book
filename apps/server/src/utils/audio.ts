import { spawnSync } from 'node:child_process'
import { logger } from './logger'

/**
 * Transcodes an audio buffer (MP3/WAV/etc) to Opus OGG format at 24kbps using ffmpeg.
 * If the buffer is already Opus (starts with "OggS"), returns it as is.
 * If ffmpeg fails, returns the original buffer as a safe fallback.
 */
export function convertToOpus(inputBuffer: Buffer): Buffer {
  if (!inputBuffer || inputBuffer.length === 0)
    return inputBuffer

  // Check if buffer is already Opus in OGG container (header "OggS")
  if (inputBuffer.length >= 4 && inputBuffer.toString('utf-8', 0, 4) === 'OggS') {
    return inputBuffer
  }

  try {
    const res = spawnSync('ffmpeg', ['-i', 'pipe:0', '-c:a', 'libopus', '-b:a', '24k', '-f', 'ogg', 'pipe:1'], {
      input: inputBuffer,
      maxBuffer: 15 * 1024 * 1024,
    })

    if (res.status === 0 && res.stdout && res.stdout.length > 0) {
      return Buffer.from(res.stdout) as Buffer
    }
  }
  catch (err) {
    logger.warn({ err }, '[Audio Utility] Failed to transcode audio to Opus, falling back to original buffer')
  }

  return inputBuffer
}

/**
 * Calculates or extracts duration of an audio buffer in seconds.
 * Uses ffmpeg to parse the container/stream time and returns float seconds (e.g. 2.45).
 * Falls back safely to 0 if buffer is empty or inspection fails.
 */
export function getAudioDurationSeconds(inputBuffer: Buffer): number {
  if (!inputBuffer || inputBuffer.length === 0)
    return 0

  try {
    const res = spawnSync('ffmpeg', ['-i', 'pipe:0', '-f', 'null', '-'], {
      input: inputBuffer,
      maxBuffer: 5 * 1024 * 1024,
    })

    const output = (res.stderr || '').toString()
    const matches = [...output.matchAll(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g)]
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1]
      const hours = Number.parseFloat(lastMatch[1])
      const minutes = Number.parseFloat(lastMatch[2])
      const seconds = Number.parseFloat(lastMatch[3])
      const totalSeconds = hours * 3600 + minutes * 60 + seconds
      return Math.round(totalSeconds * 100) / 100
    }
  }
  catch (err) {
    logger.warn({ err }, '[Audio Utility] Failed to extract audio duration via ffmpeg')
  }

  return 0
}
