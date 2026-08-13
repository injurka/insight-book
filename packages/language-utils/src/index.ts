/**
 * Утилиты валидации «слов» по письменности языка.
 * Общий модуль для server (apps/server) и client (apps/client) — единственный источник правды,
 * держать копии в приложениях НЕ нужно.
 */

export function normalizeLanguageCode(code?: string | null): string {
  if (!code)
    return ''

  return code.toLowerCase().split(/[-,;]/)[0].trim()
}

// Письменности, допустимые для «слова»:
// - \p{Script=...} — буквы конкретной письменности
// - \p{N} — цифры (ASCII и полной ширины)
// - \p{M} — комбинируемые диакритические знаки (NFD: «e» + U+0301, Script=Inherited)
// Якорные границы: слово должно начинаться и заканчиваться буквой/цифрой скрипта,
// чтобы «-apple», «hello-» и «'world'» не проходили; апострофы/дефисы — только внутри.
// Lookahead требует минимум одну букву — голые цифры («5») и пунктуация словом не считаются.
const WORD_SCRIPTS: Record<string, RegExp> = {
  latin: /^(?=.*\p{Script=Latin})[\p{Script=Latin}\p{N}](?:[\p{Script=Latin}\p{M}\p{N}'’-]*[\p{Script=Latin}\p{N}])?$/u,
  cyrillic: /^(?=.*\p{Script=Cyrillic})[\p{Script=Cyrillic}\p{N}](?:[\p{Script=Cyrillic}\p{M}\p{N}'’-]*[\p{Script=Cyrillic}\p{N}])?$/u,
  han: /^(?=.*\p{Script=Han})[\p{Script=Han}\p{N}](?:[\p{Script=Han}\p{M}\p{N}]*[\p{Script=Han}\p{N}])?$/u,
  // ja: ー (U+30FC, продлённый знак) и ・ (U+30FB, точка-разделитель) имеют Script=Common —
  // в классы включены явно: ー может стоять и в конце слова (スーパー), ・ только внутри (ア・リーグ)
  japanese: /^(?=.*[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{N}](?:[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{M}\p{N}ー・]*[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{N}ー])?$/u,
  hangul: /^(?=.*\p{Script=Hangul})[\p{Script=Hangul}\p{N}](?:[\p{Script=Hangul}\p{M}\p{N}]*[\p{Script=Hangul}\p{N}])?$/u,
}

// sr намеренно отсутствует: сербский использует и кириллицу, и латиницу —
// фильтр по одной письменности давал бы ложные срабатывания.
const LANGUAGE_SCRIPTS: Record<string, keyof typeof WORD_SCRIPTS> = {
  // Латиница
  en: 'latin',
  de: 'latin',
  fr: 'latin',
  es: 'latin',
  it: 'latin',
  pt: 'latin',
  nl: 'latin',
  pl: 'latin',
  tr: 'latin',
  cs: 'latin',
  vi: 'latin',
  id: 'latin',
  // Кириллица
  ru: 'cyrillic',
  uk: 'cyrillic',
  be: 'cyrillic',
  bg: 'cyrillic',
  // Азия
  zh: 'han',
  ja: 'japanese',
  ko: 'hangul',
}

export interface LanguageValidationOptions {
  /**
   * Разрешать слова на латинице (бренды, сленг — «Wi-Fi», «OK», «iPhone»)
   * для книг не на латинице. Для интерактивных запросов пользователя (клик по слову),
   * в фоновом массовом анализе — false, чтобы не жечь токены на каждом бренде.
   */
  allowLatinFallback?: boolean
}

export function isValidWordForLanguage(word: string, language: string, options: LanguageValidationOptions = {}): boolean {
  const normalizedWord = word.trim().normalize('NFC')
  if (!normalizedWord)
    return false

  const script = LANGUAGE_SCRIPTS[normalizeLanguageCode(language)]
  // Язык вне карты — не блокируем (неизвестные/новые языки)
  if (!script)
    return true

  if (WORD_SCRIPTS[script].test(normalizedWord))
    return true

  if (options.allowLatinFallback && script !== 'latin')
    return WORD_SCRIPTS.latin.test(normalizedWord)

  return false
}
