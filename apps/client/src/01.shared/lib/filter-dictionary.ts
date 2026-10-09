import type { UserDictItem } from '~/01.shared/types/models'
import type { DictionaryPageOptions } from '~/01.shared/types/schemas/dictionary.schema'
import { DIFFICULTY_SYSTEMS } from '~/01.shared/constants/difficulties'

export function filterDictionary(words: UserDictItem[], options: DictionaryPageOptions): UserDictItem[] {
  const language = options.language
  const decks = selection(options.decks).map(id => /^\d+$/.test(id) ? Number(id) : id)
  const difficulties = selection(options.difficulties)
  const statuses = selection(options.statuses)
  const search = options.search
  let result = words

  if (language && language !== 'all')
    result = result.filter(wordItem => wordItem.language === language)

  if (!decks.includes('all')) {
    result = result.filter((wordItem) => {
      if (!wordItem.deckIds || wordItem.deckIds.length === 0)
        return decks.includes('none')

      return wordItem.deckIds.some((id: number) => decks.includes(id))
    })
  }

  if (!difficulties.includes('all')) {
    result = result.filter((wordItem) => {
      return difficulties.some((diffVal) => {
        if (diffVal === 'none')
          return !wordItem.difficulty

        if (diffVal.startsWith('level_')) {
          const targetLevel = Number.parseInt(diffVal.split('_')[1], 10)
          const sys = DIFFICULTY_SYSTEMS[wordItem.language] || DIFFICULTY_SYSTEMS.default
          const diffDef = sys.find(sysItem => sysItem.value === wordItem.difficulty)

          return diffDef && diffDef.level === targetLevel
        }

        return wordItem.difficulty === diffVal
      })
    })
  }

  if (!statuses.includes('all'))
    result = result.filter(wordItem => statuses.includes(String(wordItem.state) as '0' | '1' | '2' | '3'))

  if (search) {
    const lowerTerm = search.toLowerCase()
    result = result.filter(item => matchesSearchTerm(item, lowerTerm))
  }

  return result
}

function matchesSearchTerm(item: UserDictItem, lowerTerm: string): boolean {
  const fields = [item.word, item.transcription, item.translation, item.notes, item.tags, item.difficulty]

  return fields.some(field => field && field.toLowerCase().includes(lowerTerm))
}

function selection(value?: string): string[] {
  return (value || 'all').split(',')
}
