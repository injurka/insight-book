import type { LexicalWordData } from '../../types'
import type { ProfileToken, WordEvidence } from './types'

const isContentTag = (pos: string) => /^[nvad]/u.test(pos) || ['word', 'unk'].includes(pos)
const isNameTag = (pos: string) => /^n[rst]/u.test(pos)
const normalize = (word: string) => word.normalize('NFKC').replace(/’/g, '\'').toLowerCase()
const byFrequency = (a: LexicalWordData, b: LexicalWordData) => b.count - a.count || a.word.localeCompare(b.word)

export class LexicalProfile {
  private words = new Map<string, WordEvidence>()
  private surfaces = new Set<string>()
  private phrases = new Map<string, WordEvidence>()
  private pos: Record<string, number> = {}
  private tokens = 0
  private contentTokens = 0
  private pages = new Set<number>()
  private window: string[] = []
  private windowCounts = new Map<string, number>()
  private windowIndex = 0
  private diversitySum = 0
  private windows = 0

  constructor(private language: string) {}

  addSentence(tokens: ProfileToken[], page: number) {
    let previous: ProfileToken | undefined
    for (const token of tokens) {
      // Whitespace separates words but does not interrupt a collocation.
      if (/^\s+$/u.test(token.word))
        continue
      if (!/^\p{L}[\p{L}\p{M}\p{N}'’・-]*$/u.test(token.word.normalize('NFKC'))) {
        previous = undefined
        continue
      }
      this.tokens++
      this.surfaces.add(normalize(token.word))
      this.pages.add(page)
      this.pos[token.pos] = (this.pos[token.pos] || 0) + 1
      if (!isContentTag(token.pos)) {
        previous = undefined
        continue
      }
      this.contentTokens++
      const key = normalize(token.lemma || token.word)
      this.record(this.words, key, token, page)
      this.addDiversity(key)
      // Adjacent adjective+noun and noun+noun pairs, never across punctuation or sentences.
      if (previous && /^[na]/u.test(previous.pos) && token.pos.startsWith('n') && !previous.entity && !token.entity && !isNameTag(previous.pos) && !isNameTag(token.pos) && !previous.nameCandidate && !token.nameCandidate) {
        const phrase = `${normalize(previous.word)}${['zh', 'ja'].includes(this.language) ? '' : ' '}${normalize(token.word)}`
        this.record(this.phrases, phrase, { word: phrase, pos: 'phrase' }, page)
      }
      previous = token
    }
  }

  private record(target: Map<string, WordEvidence>, key: string, token: ProfileToken, page: number) {
    let entry = target.get(key)
    if (!entry) {
      entry = { word: key, pos: token.pos, posCounts: new Map(), count: 0, pages: new Set(), capitalized: 0, entity: 0, forms: new Map() }
      target.set(key, entry)
    }
    entry.count++
    const posCount = (entry.posCounts.get(token.pos) || 0) + 1
    entry.posCounts.set(token.pos, posCount)
    if (posCount > (entry.posCounts.get(entry.pos) || 0))
      entry.pos = token.pos
    entry.pages.add(page)
    entry.forms.set(token.word, (entry.forms.get(token.word) || 0) + 1)
    if (/^\p{Lu}/u.test(token.word))
      entry.capitalized++
    if (token.entity || isNameTag(token.pos))
      entry.entity++
  }

  private addDiversity(key: string) {
    if (this.window.length === 100) {
      const old = this.window[this.windowIndex]
      const count = (this.windowCounts.get(old) || 0) - 1
      if (count)
        this.windowCounts.set(old, count)
      else this.windowCounts.delete(old)
      this.window[this.windowIndex] = key
    }
    else {
      this.window.push(key)
    }
    this.windowIndex = (this.windowIndex + 1) % 100
    this.windowCounts.set(key, (this.windowCounts.get(key) || 0) + 1)
    if (this.window.length === 100) {
      this.diversitySum += this.windowCounts.size
      this.windows++
    }
  }

  finish() {
    const isName = (entry: WordEvidence) => isNameTag(entry.pos)
      || (entry.entity >= 2 && (['zh', 'ja'].includes(this.language) || entry.capitalized / entry.count >= 0.8))
    const toWord = (entry: WordEvidence): LexicalWordData => ({
      word: isName(entry) ? (this.language === 'ru' ? entry.word.charAt(0).toUpperCase() + entry.word.slice(1) : [...entry.forms].sort((a, b) => b[1] - a[1])[0][0]) : entry.word,
      pos: entry.pos,
      count: entry.count,
      pageCount: entry.pages.size,
      forms: [...entry.forms.keys()].slice(0, 6),
    })
    const entries = [...this.words.values()]
    const names = entries.filter(isName)
    const lexical = entries.filter(entry => !isName(entry))
    const ranked = lexical.map(toWord).sort((a, b) => (b.count * Math.log2(1 + (b.pageCount || 1))) - (a.count * Math.log2(1 + (a.pageCount || 1))) || byFrequency(a, b))
    const rareLimit = Math.min(20, Math.max(5, Math.floor(this.contentTokens / 10000)))
    const rareWords = ranked.filter(w => w.count >= 2 && w.count <= rareLimit && w.word.length >= (['zh', 'ja'].includes(this.language) ? 2 : 4) && w.pos !== 'unk')
      .sort((a, b) => (b.pageCount || 0) - (a.pageCount || 0) || byFrequency(a, b))
      .slice(0, 30)
    const diversity = this.windows ? Math.round(this.diversitySum / this.windows) : null
    return {
      posDistribution: this.pos,
      topWords: {
        version: 2,
        nouns: ranked.filter(w => w.pos.startsWith('n')).slice(0, 30),
        verbs: ranked.filter(w => w.pos.startsWith('v')).slice(0, 30),
        adjs: ranked.filter(w => /^[ad]/u.test(w.pos)).slice(0, 30),
        properNouns: names.map(toWord).sort(byFrequency).slice(0, 30),
        rareWords,
        phrases: [...this.phrases.values()].filter(w => w.count >= 3).map(toWord).sort(byFrequency).slice(0, 24),
        words: ranked.filter(w => ['word', 'unk'].includes(w.pos)).slice(0, 30),
        metrics: { tokens: this.tokens, contentTokens: this.contentTokens, vocabulary: lexical.length, pages: this.pages.size, sampleSize: 100, diversity, rareLimit, tagged: ['en', 'ru', 'zh', 'ja'].includes(this.language) && Object.keys(this.pos).some(tag => !['x', 'unk', 'word'].includes(tag)) },
      },
      lexicalDiversity: diversity ?? 0,
      // Cache progress uses unique surface words, not the number of occurrences or lemmas.
      totalWords: this.surfaces.size,
    }
  }
}
