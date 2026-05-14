/// <reference lib="webworker" />

import { processEpub } from '../services/epub.service'
import { processFb2 } from '../services/fb2.service'
import { processCbz } from '../services/manga.service'
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
        result = await processEpub(payload.buffer, payload.filename)
        break
      case 'processFb2':
        result = await processFb2(payload.buffer, payload.filename, payload.userId)
        break
      case 'processCbz':
        result = await processCbz(payload.buffer, payload.filename)
        break
      case 'tokenizeHtmlPage':
        result = await tokenizeHtmlPage(payload.html, payload.language)
        break
      case 'tokenizeOcrBlocks':
        result = await tokenizeOcrBlocks(payload.blocks, payload.language)
        break
      case 'analyzeBookVocabulary':
        result = await analyzeBookVocabulary(payload.bookId, payload.language)
        break
      default:
        throw new Error(`Unknown task type: ${type}`)
    }

    self.postMessage({ id, success: true, data: result })
  }
  catch (error: any) {
    self.postMessage({ id, success: false, error: error.message || String(error) })
  }
}
