import { describe, expect, spyOn, test } from 'bun:test'
import * as cheerio from 'cheerio'
import { splitIntoSentences } from '../sentence-splitter'
import { collectTextBlocks } from './html-blocks'
import { LexicalProfile } from './profile'
import { tokenizeHtmlPage, tokenizeOcrBlocks } from './reader-tokenizer'
import { getTokenizer, tokenizeText } from './tokenizers'

const samples = [
  ['en-US', 'Hello, world! It’s a well-known café.'],
  ['ru-RU', 'Кошки бегут; кошка бежала. Красивый дом!'],
  ['zh-CN', '漂亮的房子；小猫跑步。北京！'],
  ['ja-JP', '猫が走った。青い空。東京のスーパー！'],
  ['de', 'Die Katzen laufen. Schönes Haus!'],
  ['fr', 'Les chats courent. C’est l’été !'],
  ['es', '¡Hola! ¿Cómo estás?'],
  ['it', 'I gatti corrono. Bella casa!'],
  ['pt', 'Os gatos correm. Olá!'],
  ['ko', '고양이가 달린다. 안녕하세요!'],
  ['ar', 'مرحبا بالعالم. هذا كتاب!'],
  ['hi', 'नमस्ते दुनिया। यह किताब है।'],
  ['th', 'แมววิ่ง สวัสดีครับ!'],
  ['vi', 'Xin chào! Đây là sách.'],
  ['uk', 'Привіт! Це гарний будинок.'],
  ['invalid_locale', 'Hello; world！ Next.'],
  ['', 'Text with\nline breaks & <symbols>.'],
] as const

describe('multilingual tokenization contract', () => {
  for (const [language, text] of samples) {
    test(`preserves source text and HTML/OCR metadata: ${language || 'empty locale'}`, async () => {
      const sentences = splitIntoSentences(text, language)
      expect(sentences.join('')).toBe(text)
      for (const sentence of sentences)
        expect((await tokenizeText(sentence, language)).map(token => token.word).join('')).toBe(sentence)
      const html = `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
      const { processedHtml } = await tokenizeHtmlPage(html, language)
      const $ = cheerio.load(processedHtml)
      expect($('p').text()).toBe(text)
      const raws = new Map<string, string>()
      $('.sentence').each((_, el) => {
        raws.set($(el).attr('data-sent-id')!, decodeURIComponent($(el).attr('data-raw-sent')!))
      })
      expect([...raws.values()]).toEqual(sentences.filter(sentence => /[\p{L}\p{N}]/u.test(sentence)))
      const { processedBlocks } = await tokenizeOcrBlocks([{ text }], language)
      expect(cheerio.load(processedBlocks[0].html!)('body').text()).toBe(text)
    })
  }

  test('HTML formatting retains whole words, sentence IDs and block boundaries', async () => {
    const source = '<p>The ca<em>t</em> sleeps</p><p>Next sentence<br>Last one</p><script>ignored()</script><style>ignored{}</style>'
    const blocks = collectTextBlocks(cheerio.load(source, null, false).root().contents().toArray())
    expect(blocks.map(block => block.fullText)).toEqual(['The cat sleeps', 'Next sentence', 'Last one'])
    const $ = cheerio.load((await tokenizeHtmlPage(source, 'en')).processedHtml)
    const cats = $('.word').filter((_, el) => decodeURIComponent($(el).attr('data-word')!) === 'cat')
    expect(cats).toHaveLength(2)
    expect(cats.map((_, el) => $(el).text()).get().join('')).toBe('cat')
    expect(new Set(cats.map((_, el) => $(el).attr('data-token-idx')).get()).size).toBe(1)
  })

  test('EPUB fragments preserve the full sentence and time', async () => {
    const first = 'The transformation occurred'
    const last = ' at approximately 2:23 AM, Pacific Standard Time. '
    const next = 'As far as I could tell, anyone who was indoors when it happened died instantly.'
    const $ = cheerio.load((await tokenizeHtmlPage(`<p><span class="class_s4sc">${first}</span>${last}${next}</p>`, 'en')).processedHtml)
    expect($('p').text()).toBe(first + last + next)
    const fragments = $('.sentence[data-sent-id="0"]')
    expect(fragments).toHaveLength(2)
    expect(fragments.map((_, el) => $(el).text()).get()).toEqual([first, last])
    for (const el of fragments.toArray())
      expect(decodeURIComponent($(el).attr('data-raw-sent')!)).toBe(first + last)
    expect($('.sentence[data-sent-id="1"]').text()).toBe(next)
    expect($('.class_s4sc').text()).toBe(first)
  })

  test('HTML and OCR share fallback when a tokenizer loses characters', async () => {
    const spy = spyOn(getTokenizer('en'), 'tokenize').mockReturnValue([{ word: 'lost', pos: 'n' }])
    try {
      const text = 'Hello, world!'
      expect((await tokenizeText(text, 'en')).map(token => token.word).join('')).toBe(text)
      const { processedBlocks } = await tokenizeOcrBlocks([{ text }], 'en')
      expect(cheerio.load(processedBlocks[0].html!)('body').text()).toBe(text)
    }
    finally { spy.mockRestore() }
  })

  test('Russian lemmas and phrases use real morphology', async () => {
    const profile = new LexicalProfile('ru')
    profile.addSentence(await tokenizeText('Кошки бегут. Кошка бежала. Красивый дом. Красивый дом. Красивый дом.', 'ru'), 1)
    const result = profile.finish()
    expect(result.topWords.nouns.find(word => word.word === 'кошка')?.count).toBe(2)
    expect(result.topWords.verbs.find(word => word.word === 'бежать')?.count).toBe(2)
    expect(result.topWords.phrases.find(word => word.word === 'красивый дом')?.count).toBe(3)
  })

  test('Japanese lemmas, names and prolonged vowels survive profiling', async () => {
    const profile = new LexicalProfile('ja')
    profile.addSentence(await tokenizeText('猫が走った。猫が走る。東京のスーパー。東京のスーパー。', 'ja'), 1)
    const result = profile.finish()
    expect(result.topWords.verbs.find(word => word.word === '走る')?.count).toBe(2)
    expect(result.topWords.properNouns.find(word => word.word === '東京')?.count).toBe(2)
    expect(result.topWords.nouns.find(word => word.word === 'スーパー')?.count).toBe(2)
  })

  test('Chinese segmentation and names; untagged languages stay explicit', async () => {
    const profile = new LexicalProfile('zh')
    profile.addSentence(await tokenizeText('漂亮的房子。北京。北京。', 'zh'), 1)
    expect(profile.finish().topWords.nouns.find(word => word.word === '房子')).toBeDefined()
    expect(profile.finish().topWords.properNouns.find(word => word.word === '北京')).toBeDefined()
    const fallback = new LexicalProfile('de')
    fallback.addSentence(await tokenizeText('Katzen laufen.', 'de'), 1)
    expect(fallback.finish().topWords.metrics.tagged).toBe(false)
    expect(fallback.finish().topWords.words).toHaveLength(2)
  })
})
