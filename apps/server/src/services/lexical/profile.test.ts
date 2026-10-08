import { describe, expect, test } from 'bun:test'
import { tokenizeEnglishProfile } from './english'
import { LexicalProfile } from './profile'

function analyze(pages: string[]) {
  const profile = new LexicalProfile('en')
  const cache = new Map<string, string>()
  pages.forEach((page, index) => profile.addSentence(tokenizeEnglishProfile(page, cache), index))
  return profile.finish()
}

describe('lexical profile', () => {
  test('pronouns, contractions and sentence capitals are not names', () => {
    const sentence = 'It is dark. You see Donut. My cat follows Mordecai. We see London. Her room is large. They are here. It\'s my room. The room is dark.'
    const result = analyze([sentence, sentence, sentence])
    const names = result.topWords.properNouns.map(w => w.word)
    expect(names).toEqual(expect.arrayContaining(['Donut', 'Mordecai', 'London']))
    for (const word of ['It', 'You', 'My', 'Her', 'Room']) expect(names).not.toContain(word)
    expect(result.topWords.nouns.some(w => w.word === 'room')).toBe(true)
    expect(result.topWords.nouns.some(w => w.word === 'it')).toBe(false)
  })
  test('groups inflected words and retains page coverage', () => {
    const result = analyze(['The cats were running. The cat will run.', 'The cat was running.'])
    expect(result.topWords.nouns.find(w => w.word === 'cat')).toMatchObject({ count: 3, pageCount: 2 })
    expect(result.topWords.verbs.find(w => w.word === 'run')).toMatchObject({ count: 3, pageCount: 2 })
    expect(result.totalWords).toBeGreaterThan(result.topWords.metrics.vocabulary)
  })
  test('names beyond displayed limit stay excluded; ordinary capitalized nouns remain', () => {
    const profile = new LexicalProfile('en')
    for (let i = 0; i < 40; i++) {
      const word = `Person${String.fromCharCode(65 + i % 26)}${String.fromCharCode(65 + Math.floor(i / 26))}`
      profile.addSentence([{ word, pos: 'n', entity: true }], 0)
      profile.addSentence([{ word, pos: 'n', entity: true }], 1)
    }
    profile.addSentence([{ word: 'Room', pos: 'n' }, { word: 'Room', pos: 'n' }], 1)
    const result = profile.finish()
    expect(result.topWords.properNouns).toHaveLength(30)
    expect(result.topWords.nouns.map(w => w.word)).toEqual(['room'])
  })
  test('no score for short samples; sliding diversity is bounded', () => {
    expect(analyze([]).topWords.metrics.diversity).toBeNull()
    expect(analyze(['The cat walks.']).topWords.metrics.diversity).toBeNull()
    const profile = new LexicalProfile('en')
    for (let i = 0; i < 1000; i++) profile.addSentence([{ word: i % 2 ? 'cat' : 'dog', pos: 'n' }], 0)
    expect(profile.finish().lexicalDiversity).toBe(2)
  })
  test('phrases never bridge punctuation or function words', () => {
    const result = analyze(['A dark room. A dark room. A dark room. Dark, room. Dark and room.'])
    expect(result.topWords.phrases.find(w => w.word === 'dark room')?.count).toBe(3)
  })
  test('rare words exclude names and POS counts cover all words', () => {
    const result = analyze(['A silver lantern. A silver lantern. We see Mordecai. We see Mordecai.'])
    expect(result.topWords.rareWords.some(w => w.word === 'lantern')).toBe(true)
    expect(result.topWords.rareWords.some(w => w.word.toLowerCase() === 'mordecai')).toBe(false)
    expect(Object.values(result.posDistribution).reduce((a, b) => a + b, 0)).toBe(result.topWords.metrics.tokens)
  })
  test('uses dominant part of speech and Russian name base forms', () => {
    const profile = new LexicalProfile('ru')
    profile.addSentence([{ word: 'Москве', lemma: 'москва', pos: 'n', entity: true }, { word: 'Москву', lemma: 'москва', pos: 'n', entity: true }], 0)
    profile.addSentence([{ word: 'light', pos: 'n' }, { word: 'light', pos: 'a' }, { word: 'light', pos: 'a' }], 0)
    const result = profile.finish()
    expect(result.topWords.properNouns[0]?.word).toBe('Москва')
    expect(result.topWords.adjs[0]?.word).toBe('light')
  })
  test('Japanese names do not require Latin capitalization', () => {
    const profile = new LexicalProfile('ja')
    profile.addSentence([{ word: '東京', pos: 'n', entity: true }, { word: '東京', pos: 'n', entity: true }], 0)
    expect(profile.finish().topWords.properNouns[0]?.word).toBe('東京')
  })
})

describe('multilingual profile boundaries', () => {
  test('whitespace preserves phrases, punctuation interrupts them', () => {
    const profile = new LexicalProfile('ru')
    for (let i = 0; i < 3; i++) {
      profile.addSentence([{ word: 'красивый', pos: 'a' }, { word: ' ', pos: 'x' }, { word: 'дом', pos: 'n' }], i)
      profile.addSentence([{ word: 'красивый', pos: 'a' }, { word: ',', pos: 'x' }, { word: 'дом', pos: 'n' }], i)
    }
    expect(profile.finish().topWords.phrases[0]).toMatchObject({ word: 'красивый дом', count: 3, pageCount: 3 })
  })
  test('detailed Chinese noun tags form phrases but names do not', () => {
    const profile = new LexicalProfile('zh')
    for (let i = 0; i < 3; i++) {
      profile.addSentence([{ word: '美好', pos: 'ad' }, { word: '生活', pos: 'ng' }], i)
      profile.addSentence([{ word: '北京', pos: 'ns' }, { word: '生活', pos: 'ng' }], i)
    }
    expect(profile.finish().topWords.phrases.map(word => word.word)).toEqual(['美好生活'])
  })
  test('combining marks and alphanumeric words are retained', () => {
    const profile = new LexicalProfile('fr')
    profile.addSentence([{ word: 'cafe\u0301', pos: 'word' }, { word: 'café', pos: 'word' }, { word: 'B2B', pos: 'word' }, { word: '123', pos: 'word' }], 0)
    expect(profile.finish().topWords.words).toEqual(expect.arrayContaining([expect.objectContaining({ word: 'café', count: 2 }), expect.objectContaining({ word: 'b2b', count: 1 })]))
    expect(profile.finish().topWords.metrics.tokens).toBe(3)
  })
})
