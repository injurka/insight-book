export const REQUIRED_WORD_CONTENT_FIELDS = ['translation', 'difficulty'] as const

type WordContentField = typeof REQUIRED_WORD_CONTENT_FIELDS[number]
type WordContent = Partial<Record<WordContentField, unknown>>

export function missingWordContentFields(content: WordContent | null | undefined): WordContentField[] {
  return REQUIRED_WORD_CONTENT_FIELDS.filter((field) => {
    const value = content?.[field]

    return typeof value !== 'string' || !value.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ').trim()
  })
}

export function isWordContentComplete(content: WordContent | null | undefined): boolean {
  return missingWordContentFields(content).length === 0
}
