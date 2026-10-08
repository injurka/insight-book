import type { ProfileToken } from './types'
import nlp from 'compromise'

const functionWords = new Set(`i me my mine myself you your yours yourself yourselves he him his himself she her hers herself it its itself we us our ours ourselves they them their theirs themselves this that these those who whom whose what which there here some any something anything everything nothing someone anyone everyone nobody yes no not oh hey the a an and or but if as of to in on at by for from with without into onto through out up down over under than then very just also too so now how why when where is are am was were be been being have has had do does did will would shall should can could may might must don't doesn't didn't isn't aren't wasn't weren't won't wouldn't can't couldn't shouldn't it's i'm you're he's she's we're they're i've you've we've they've i'd you'd he'd she'd we'd they'd i'll you'll he'll she'll we'll they'll`.split(/\s+/))

export function tokenizeEnglishProfile(text: string, lemmaCache: Map<string, string>): ProfileToken[] {
  const result: ProfileToken[] = []
  for (const sentence of nlp(text).json()) {
    for (const [index, term] of sentence.terms.entries()) {
      const word = term.text.normalize('NFKC').replace(/’/g, '\'')
      const normal = word.toLowerCase().replace(/'s$/u, '')
      const tags: string[] = term.tags
      const functional = functionWords.has(word.toLowerCase()) || tags.some(tag => ['Pronoun', 'Determiner', 'Conjunction', 'Preposition', 'Auxiliary', 'Copula', 'Modal', 'Particle', 'Value'].includes(tag))
      const pos = functional ? 'u' : tags.includes('Verb') ? 'v' : tags.includes('Adjective') ? 'a' : tags.includes('Adverb') ? 'd' : tags.includes('Noun') ? 'n' : 'unk'
      const capitalized = /^\p{Lu}/u.test(word) && !/^\p{Lu}+$/u.test(word)
      const entity = !functional && capitalized && tags.includes('ProperNoun') && index > 0
      const cacheKey = `${pos}:${normal}`
      let lemma = lemmaCache.get(cacheKey)
      if (!lemma) {
        const doc = nlp(normal)
        if (pos === 'v')
          doc.tag('Verb')
        if (pos === 'n')
          doc.tag('Noun')
        lemma = pos === 'v' ? doc.verbs().toInfinitive().text() : pos === 'n' ? doc.nouns().toSingular().text() : normal
        // Keep one lexical unit; an auxiliary expansion is not a lemma.
        if (!lemma || /\s/u.test(lemma))
          lemma = normal
        lemmaCache.set(cacheKey, lemma || normal)
      }
      result.push({ word, pos, lemma, entity, nameCandidate: !functional && capitalized && index > 0 })
      if (/[.!?,;:]/u.test(term.post))
        result.push({ word: term.post, pos: 'x' })
    }
    result.push({ word: '.', pos: 'x' })
  }
  return result
}
