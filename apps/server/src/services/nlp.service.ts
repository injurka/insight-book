import type { TokenizedSentence, TokenizedWord } from '../types'
import process from 'node:process'

const HANLP_URL = process.env.HANLP_URL || 'http://localhost:8765/tokenize'

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

async function tokenizeBatchWithHanLP(sentences: string[]): Promise<TokenizedWord[][]> {
  const res = await fetch(HANLP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts: sentences }),
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`HanLP batch error: ${res.status} - ${errorText}`)
  }

  const data = await res.json() as Array<Array<[string, string]>>

  return data.map(sentenceTokens =>
    sentenceTokens.map(([word, pos]) => ({ word, pos })),
  )
}

/**
 * Основная функция. Токенизирует весь текст страницы, используя один батч-запрос.
 */
export async function tokenizePage(text: string): Promise<TokenizedSentence[]> {
  const sentences = splitIntoSentences(text)
  if (sentences.length === 0) {
    return []
  }

  let allTokens: TokenizedWord[][]
  try {
    allTokens = await tokenizeBatchWithHanLP(sentences)
  }
  catch (error) {
    console.warn('[NLP Fallback] HanLP batch request failed, using simple tokenizer.', error)
    throw new Error('HanLP Error')
  }

  return sentences.map((raw, i) => ({
    sentenceId: i,
    tokens: allTokens[i] || [],
    raw,
  }))
}
