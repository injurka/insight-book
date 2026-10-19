import { isValidWordForLanguage } from '@injurka/insight-book-language-utils'

export function isBookDeckWord(word: string, language: string): boolean {
  if (!/^\p{L}[\p{L}\p{M}'・-]*$/u.test(word) || word.length > 100)
    return false

  return isValidWordForLanguage(word, language)
}
