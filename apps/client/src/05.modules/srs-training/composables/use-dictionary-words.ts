import { dictionaryWords } from '~/05.modules/dictionary/store/dictionary-words.state'

/**
 * Предоставляет доступ к реактивному списку слов словаря.
 * srs-training модуль использует эти данные для генерации дистракторов
 * в quiz-режимах, не импортируя весь dictionary.store.
 */
export function useDictionaryWords() {
  return dictionaryWords
}
