import { describe, expect, it } from 'bun:test'
import { splitTextIntoSentences, tokenizeDialogueText, tokenizeSentenceWords } from './dialogue-tokenizer'

describe('dialogue-tokenizer', () => {
  it('splits sentences correctly for English', () => {
    const text = 'Hello world! How are you doing today? I am doing great.'
    const sentences = splitTextIntoSentences(text, 'en')

    expect(sentences.length).toBe(3)
    expect(sentences[0]).toBe('Hello world!')
    expect(sentences[1]).toBe('How are you doing today?')
    expect(sentences[2]).toBe('I am doing great.')
  })

  it('splits sentences correctly for Russian', () => {
    const text = 'Привет мир! Как твои дела? Всё отлично.'
    const sentences = splitTextIntoSentences(text, 'ru')

    expect(sentences.length).toBe(3)
    expect(sentences[0]).toBe('Привет мир!')
    expect(sentences[1]).toBe('Как твои дела?')
    expect(sentences[2]).toBe('Всё отлично.')
  })

  it('splits sentences correctly for Chinese', () => {
    const text = '你好！你今天怎么样？我很好。'
    const sentences = splitTextIntoSentences(text, 'zh')

    expect(sentences.length).toBe(3)
    expect(sentences[0]).toBe('你好！')
    expect(sentences[1]).toBe('你今天怎么样？')
    expect(sentences[2]).toBe('我很好。')
  })

  it('tokenizes sentence words with valid POS and index', () => {
    const tokens = tokenizeSentenceWords('Hello world!', 'en', 1)
    const words = tokens.filter(t => !t.isPunct)

    expect(words.length).toBe(2)
    expect(words[0].word).toBe('Hello')
    expect(words[0].pos).toBe('word')
    expect(words[0].tokenIdx).toBe(0)
    expect(words[1].word).toBe('world')
    expect(words[1].pos).toBe('word')
    expect(words[1].tokenIdx).toBe(1)

    const punct = tokens.filter(t => t.isPunct)
    expect(punct.some(p => p.word === '!')).toBe(true)
  })

  it('tokenizeDialogueText produces valid structured sentences', () => {
    const res = tokenizeDialogueText('Hello! How are you?', 'en', 100)

    expect(res.length).toBe(2)
    expect(res[0].sentId).toBe(100)
    expect(res[0].index).toBe(0)
    expect(res[0].rawSent).toBe('Hello!')
    expect(res[1].sentId).toBe(101)
    expect(res[1].index).toBe(1)
    expect(res[1].rawSent).toBe('How are you?')
  })
})
