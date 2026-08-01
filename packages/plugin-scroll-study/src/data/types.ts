export interface CharacterData {
  id: string
  char: string
  variants: string[]
  pinyin: string
  translation: string
  tier: number
  components: string[]
  isStandaloneWord: boolean
  themeGroupId: string
  etymology: string
  partOfSpeech: string[]
  hskLevel: number
  strokeCount: number
}
