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
