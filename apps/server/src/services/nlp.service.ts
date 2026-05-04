import type { TokenizedSentence, TokenizedWord } from '../types'
import nodejieba from 'nodejieba'

const SENTENCE_DELIMITERS = /([。！？…!?]+)/g

function splitIntoSentences(text: string): string[] {
  const parts = text.split(SENTENCE_DELIMITERS).filter(s => s.trim())
  const sentences: string[] = []
  for (let i = 0; i < parts.length; i += 2) {
    const sent = (parts[i] || '') + (parts[i + 1] || '')
    if (sent.trim())
      sentences.push(sent.trim())
  }
  return sentences.length ? sentences : [text]
}

export function tokenizePage(text: string): TokenizedSentence[] {
  const sentences = splitIntoSentences(text)
  return sentences.map((raw, sentenceId) => {
    const tagged = nodejieba.tag(raw) as Array<{ word: string, tag: string }>
    const tokens: TokenizedWord[] = tagged.map(t => ({ word: t.word, pos: t.tag }))
    return { sentenceId, tokens, raw }
  })
}
