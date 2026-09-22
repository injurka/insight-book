import { logger } from './logger'

const FFMPEG_TIMEOUT_MS = 30_000
const FFMPEG_MAX_OUTPUT_BYTES = 15 * 1024 * 1024

interface FfmpegResult {
  exitCode: number
  stderr: string
  stdout: Buffer
}

export function isMp3Audio(inputBuffer: Buffer): boolean {
  function hasMpegFrameAt(offset: number): boolean {
    if (inputBuffer.length < offset + 4)
      return false

    const header = inputBuffer.readUInt32BE(offset)
    const hasFrameSync = ((header & 0xFFE00000) >>> 0) === 0xFFE00000
    const version = (header >>> 19) & 0b11
    const layer = (header >>> 17) & 0b11
    const bitrateIndex = (header >>> 12) & 0b1111
    const sampleRateIndex = (header >>> 10) & 0b11

    return hasFrameSync
      && version !== 0b01
      && layer !== 0
      && bitrateIndex !== 0
      && bitrateIndex !== 0b1111
      && sampleRateIndex !== 0b11
  }

  if (hasMpegFrameAt(0))
    return true

  if (inputBuffer.length < 10 || inputBuffer.toString('ascii', 0, 3) !== 'ID3')
    return false

  const tagSize = (inputBuffer[6] << 21) | (inputBuffer[7] << 14) | (inputBuffer[8] << 7) | inputBuffer[9]
  const frameOffset = 10 + tagSize

  return hasMpegFrameAt(frameOffset)
}

async function runFfmpeg(args: string[], inputBuffer: Buffer): Promise<FfmpegResult> {
  const process = Bun.spawn(['ffmpeg', '-hide_banner', '-nostdin', ...args], {
    stdin: inputBuffer,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: FFMPEG_TIMEOUT_MS,
    maxBuffer: FFMPEG_MAX_OUTPUT_BYTES,
  })

  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).arrayBuffer(),
    new Response(process.stderr).text(),
  ])

  return { exitCode, stderr, stdout: Buffer.from(stdout) }
}

/**
 * Normalizes provider audio to MP3 for consistent HTMLAudioElement support,
 * including Android WebView. Already valid MP3 data is returned unchanged.
 */
export async function convertToMp3(inputBuffer: Buffer): Promise<Buffer> {
  if (inputBuffer.length === 0)
    throw new Error('Cannot transcode an empty audio buffer')

  if (isMp3Audio(inputBuffer)) {
    return inputBuffer
  }

  let result: FfmpegResult
  try {
    result = await runFfmpeg(
      ['-loglevel', 'error', '-i', 'pipe:0', '-vn', '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '48k', '-f', 'mp3', 'pipe:1'],
      inputBuffer,
    )
  }
  catch (err) {
    logger.error({ err }, '[Audio Utility] Failed to run ffmpeg for MP3 transcoding')
    throw new Error('Failed to run ffmpeg for TTS audio transcoding', { cause: err })
  }

  if (result.exitCode !== 0 || !isMp3Audio(result.stdout)) {
    logger.error({ exitCode: result.exitCode, stderr: result.stderr }, '[Audio Utility] Failed to transcode audio to MP3')
    throw new Error('Failed to transcode TTS audio to MP3')
  }

  return result.stdout
}

/**
 * Calculates audio duration through ffmpeg and returns seconds rounded to
 * hundredths. Duration is optional telemetry, so failures safely return 0.
 */
export async function getAudioDurationSeconds(inputBuffer: Buffer): Promise<number> {
  if (inputBuffer.length === 0)
    return 0

  try {
    const result = await runFfmpeg(['-i', 'pipe:0', '-f', 'null', '-'], inputBuffer)
    const matches = [...result.stderr.matchAll(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g)]
    const lastMatch = matches.at(-1)
    if (lastMatch) {
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
