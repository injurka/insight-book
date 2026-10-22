/// <reference lib="webworker" />

import { extractBookDeckWords } from '../services/book-deck/extract'
import {
  processCbz,
  processDocx,
  processEpub,
  processFb2,
  processHtml,
  processMarkdown,
  processMobi,
  processPdf,
  processSubtitle,
  processTxt,
} from '../services/book-parsers'
import { analyzeBookVocabulary, initNLP, tokenizeHtmlPage, tokenizeOcrBlocks } from '../services/nlp.service'

// eslint-disable-next-line antfu/no-top-level-await
await initNLP()

declare let self: DedicatedWorkerGlobalScope

self.onmessage = async (event: MessageEvent) => {
  const { id, type, payload } = event.data

  try {
    let result

    switch (type) {
      case 'processEpub':
        result = await processEpub(payload.filePath, payload.filename, payload.userId)
        break
      case 'processFb2':
        result = await processFb2(payload.filePath, payload.filename, payload.userId)
        break
      case 'processDocx':
        result = await processDocx(payload.filePath, payload.filename, payload.userId)
        break
      case 'processTxt':
        result = await processTxt(payload.filePath, payload.filename, payload.userId)
        break
      case 'processMarkdown':
        result = await processMarkdown(payload.filePath, payload.filename, payload.userId)
        break
      case 'processSubtitle':
        result = await processSubtitle(payload.filePath, payload.filename, payload.userId)
        break
      case 'processHtml':
        result = await processHtml(payload.filePath, payload.filename, payload.userId)
        break
      case 'processPdf':
        result = await processPdf(payload.filePath, payload.filename, payload.userId)
        break
      case 'processMobi':
        result = await processMobi(payload.filePath, payload.filename, payload.userId)
        break
      case 'processCbz':
        result = await processCbz(payload.filePath, payload.filename, payload.userId)
        break
      case 'tokenizeHtmlPage':
        result = await tokenizeHtmlPage(payload.html, payload.language)
        break
      case 'tokenizeOcrBlocks':
        result = await tokenizeOcrBlocks(payload.blocks, payload.language)
        break
      case 'extractBookDeckWords':
        result = await extractBookDeckWords(payload.bookId, payload.language)
        break
      case 'analyzeBookVocabulary':
        result = await analyzeBookVocabulary(payload.bookId, payload.language)
        break
      default:
        throw new Error(`Unknown task type: ${type}`)
    }

    self.postMessage({ id, success: true, data: result })
  }
  catch (error: unknown) {
    const err = error as Error
    self.postMessage({
      id,
      success: false,
      error: err?.message || String(error),
      stack: err?.stack,
    })
  }
}
