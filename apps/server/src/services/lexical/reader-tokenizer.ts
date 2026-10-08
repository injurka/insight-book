import { normalizeLanguageCode } from '@injurka/insight-book-language-utils'
import * as cheerio from 'cheerio'
import { splitIntoSentences } from '../sentence-splitter'
import { collectTextBlocks } from './html-blocks'
import { tokenizeText } from './tokenizers'

export async function tokenizeHtmlPage(html: string, language: string) {
  language = normalizeLanguageCode(language)
  const $ = cheerio.load(html, null, false)
  const allWords = new Set<string>()
  let sentenceIdCounter = 0

  const blocks = collectTextBlocks($.root().contents().toArray())

  for (const block of blocks) {
    const sentences = splitIntoSentences(block.fullText, language)
    const blockTokens: { text: string, pos: string, sentId: number, tokenIdx: number, encodedRaw: string, isValidSent: boolean }[] = []

    for (const sent of sentences) {
      if (!/[\p{L}\p{N}]/u.test(sent)) {
        blockTokens.push({ text: sent, pos: 'x', sentId: sentenceIdCounter, tokenIdx: 0, encodedRaw: '', isValidSent: false })
      }
      else {
        const finalTokens = await tokenizeText(sent, language)

        const encodedRaw = encodeURIComponent(sent)
        for (let i = 0; i < finalTokens.length; i++) {
          if (finalTokens[i].pos === 'x' && /[\p{L}\p{N}]/u.test(finalTokens[i].word)) {
            finalTokens[i].pos = 'unk'
          }

          blockTokens.push({ text: finalTokens[i].word, pos: finalTokens[i].pos, sentId: sentenceIdCounter, tokenIdx: i, encodedRaw, isValidSent: true })
          if (/[\p{L}\p{N}]/u.test(finalTokens[i].word)) {
            allWords.add(finalTokens[i].word)
            allWords.add(finalTokens[i].word.toLowerCase())
          }
        }
      }
      sentenceIdCounter++
    }

    let currentTokenIdx = 0
    let currentTokenCharOffset = 0

    for (const node of block.textNodes) {
      let nodeText = node.data
      let newHtml = ''
      let activeSentId = -1
      let sentenceHtmlBuf = ''
      let activeEncodedRaw = ''
      let activeIsValid = false

      const closeSentence = () => {
        if (sentenceHtmlBuf) {
          newHtml += `<span class="sentence" data-sent-id="${activeSentId}" data-raw-sent="${activeEncodedRaw}">${sentenceHtmlBuf}</span>`
          sentenceHtmlBuf = ''
        }
      }

      while (nodeText.length > 0 && currentTokenIdx < blockTokens.length) {
        const token = blockTokens[currentTokenIdx]
        const remainingInToken = token.text.substring(currentTokenCharOffset)

        const takeLen = Math.min(nodeText.length, remainingInToken.length)
        const chunk = remainingInToken.substring(0, takeLen)

        nodeText = nodeText.substring(takeLen)
        currentTokenCharOffset += takeLen

        if (currentTokenCharOffset >= token.text.length) {
          currentTokenIdx++
          currentTokenCharOffset = 0
        }

        if (token.sentId !== activeSentId || token.isValidSent !== activeIsValid) {
          if (activeSentId !== -1) {
            if (activeIsValid)
              closeSentence()
            else newHtml += sentenceHtmlBuf
            sentenceHtmlBuf = ''
          }
          activeSentId = token.sentId
          activeEncodedRaw = token.encodedRaw
          activeIsValid = token.isValidSent
        }

        if (activeIsValid) {
          const isPunct = token.pos === 'x'
          const spacingClass = (language === 'zh' || language === 'ja') ? '' : 'add-space'
          const safeChunk = chunk.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          sentenceHtmlBuf += `<span class="word ${isPunct ? 'is-punctuation' : spacingClass}" data-word="${encodeURIComponent(token.text)}" data-pos="${token.pos}" data-sent-id="${token.sentId}" data-token-idx="${token.tokenIdx}">${safeChunk}</span>`
        }
        else {
          sentenceHtmlBuf += chunk.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }
      }

      if (activeSentId !== -1) {
        if (activeIsValid)
          closeSentence()
        else newHtml += sentenceHtmlBuf
      }

      if (nodeText.length > 0) {
        newHtml += nodeText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      }
      $(node).replaceWith(newHtml)
    }
  }

  return { processedHtml: $.html(), uniqueWords: Array.from(allWords) }
}

export async function tokenizeOcrBlocks(blocks: (Record<string, unknown> & { text?: string })[], language: string) {
  language = normalizeLanguageCode(language)
  const allWords = new Set<string>()
  let sentenceIdCounter = 10000
  const processedBlocks = []

  for (const block of blocks) {
    const text = block.text
    if (!text || /^\s+$/.test(text)) {
      processedBlocks.push({ ...block, html: text })
      continue
    }

    const sentences = splitIntoSentences(text, language)
    let newHtml = ''

    for (const raw of sentences) {
      if (!/[\p{L}\p{N}]/u.test(raw)) {
        newHtml += raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        continue
      }
      const tokens = await tokenizeText(raw, language)
      const encodedRaw = encodeURIComponent(raw)
      let sentHtml = `<span class="sentence" data-sent-id="${sentenceIdCounter}" data-raw-sent="${encodedRaw}">`

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]

        if (t.pos === 'x' && /[\p{L}\p{N}]/u.test(t.word)) {
          t.pos = 'unk'
        }

        if (/[\p{L}\p{N}]/u.test(t.word)) {
          allWords.add(t.word)
          allWords.add(t.word.toLowerCase())
        }
        const isPunct = t.pos === 'x'
        const spacingClass = (language === 'zh' || language === 'ja') ? '' : 'add-space'
        const safeWord = t.word.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        sentHtml += `<span class="word ${isPunct ? 'is-punctuation' : spacingClass}" data-word="${encodeURIComponent(t.word)}" data-pos="${t.pos}" data-sent-id="${sentenceIdCounter}" data-token-idx="${i}">${safeWord}</span>`
      }
      sentHtml += '</span>'
      sentenceIdCounter++
      newHtml += sentHtml
    }
    processedBlocks.push({ ...block, html: newHtml })
  }
  return { processedBlocks, uniqueWords: Array.from(allWords) }
}
