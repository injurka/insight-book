import { Elysia, t } from 'elysia'
import { tokenizeText } from '../services/lexical/tokenizers'
import { splitIntoSentences } from '../services/sentence-splitter'
import { handleElysiaError } from '../utils/errors'
import { normalizeLanguageCode } from '../utils/helpers'

export const nlpController = new Elysia({ prefix: '/api/nlp' })
  .onError(handleElysiaError)
  .post('/tokenize', async ({ body }) => {
    const { text, language, baseSentId = 0 } = body as {
      text: string
      language: string
      baseSentId?: number
    }

    if (!text || !text.trim()) {
      return { sentences: [] }
    }

    const lang = normalizeLanguageCode(language)
    const rawSentences = splitIntoSentences(text, lang)
    const isCjk = ['zh', 'ja'].includes(lang)

    const sentences = []
    let currentSentId = baseSentId

    for (const raw of rawSentences) {
      const trimmed = raw.trim()

      if (!trimmed)
        continue

      const tokens = await tokenizeText(raw, lang)
      const finalTokens = []
      let wordIdx = 0

      for (const t of tokens) {
        if (/^\s+$/.test(t.word)) {
          if (finalTokens.length > 0 && !isCjk) {
            finalTokens[finalTokens.length - 1].spacingClass = 'add-space'
          }

          continue
        }

        const trimmedWord = t.word.trim()
        const hadTrailingSpace = /\s$/.test(t.word)
        const isWord = /[\p{L}\p{N}]/u.test(trimmedWord)

        finalTokens.push({
          word: trimmedWord,
          pos: t.pos,
          tokenIdx: isWord ? wordIdx++ : 0,
          isPunct: !isWord,
          spacingClass: (!isCjk && hadTrailingSpace) ? 'add-space' : '',
        })
      }

      sentences.push({
        sentId: currentSentId++,
        rawSent: trimmed,
        tokens: finalTokens,
      })
    }

    return { sentences }
  }, {
    body: t.Object({
      text: t.String(),
      language: t.String(),
      baseSentId: t.Optional(t.Number()),
    }),
  })
