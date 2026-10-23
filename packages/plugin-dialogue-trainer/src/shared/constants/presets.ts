import type { DialogueDifficulty, DialogueStyle, PracticeLanguageCode } from '../types/dialogue'

export interface LanguageOption {
  code: PracticeLanguageCode
  name: string
  nameKey: string
  fallbackName: string
  icon: string
  ttsVoice?: string
}

export const SUPPORTED_PRACTICE_LANGUAGES: LanguageOption[] = [
  {
    code: 'en',
    name: 'English',
    nameKey: 'plugins.dialogue-trainer.langEn',
    fallbackName: 'English',
    icon: 'mdi:alphabetical-variant',
  },
  {
    code: 'ru',
    name: 'Русский',
    nameKey: 'plugins.dialogue-trainer.langRu',
    fallbackName: 'Русский',
    icon: 'mdi:translate',
  },
  {
    code: 'zh',
    name: '中文 (Chinese)',
    nameKey: 'plugins.dialogue-trainer.langZh',
    fallbackName: '中文 (Chinese)',
    icon: 'mdi:ideogram-cjk-variant',
  },
]

export interface DifficultyOption {
  value: DialogueDifficulty
  labelKey: string
  fallbackLabel: string
  descriptionKey: string
  fallbackDesc: string
}

export const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  {
    value: 'adaptive',
    labelKey: 'plugins.dialogue-trainer.difficultyAdaptive',
    fallbackLabel: 'Авто / Адаптивный',
    descriptionKey: 'plugins.dialogue-trainer.difficultyAdaptiveDesc',
    fallbackDesc: 'ИИ сам определит ваш уровень и подстроится',
  },
  {
    value: 'a1',
    labelKey: 'plugins.dialogue-trainer.difficultyA1',
    fallbackLabel: 'A1 — Начальный',
    descriptionKey: 'plugins.dialogue-trainer.difficultyA1Desc',
    fallbackDesc: 'Простые слова, базовые фразы, медленный темп',
  },
  {
    value: 'a2',
    labelKey: 'plugins.dialogue-trainer.difficultyA2',
    fallbackLabel: 'A2 — Элементарный',
    descriptionKey: 'plugins.dialogue-trainer.difficultyA2Desc',
    fallbackDesc: 'Повседневные ситуации и простые конструкции',
  },
  {
    value: 'b1',
    labelKey: 'plugins.dialogue-trainer.difficultyB1',
    fallbackLabel: 'B1 — Средний',
    descriptionKey: 'plugins.dialogue-trainer.difficultyB1Desc',
    fallbackDesc: 'Свободное общение на знакомые темы',
  },
  {
    value: 'b2',
    labelKey: 'plugins.dialogue-trainer.difficultyB2',
    fallbackLabel: 'B2 — Выше среднего',
    descriptionKey: 'plugins.dialogue-trainer.difficultyB2Desc',
    fallbackDesc: 'Сложные грамматические обороты и идиомы',
  },
  {
    value: 'c1',
    labelKey: 'plugins.dialogue-trainer.difficultyC1',
    fallbackLabel: 'C1 — Продвинутый',
    descriptionKey: 'plugins.dialogue-trainer.difficultyC1Desc',
    fallbackDesc: 'Богатый лексикон, тонкие нюансы и беглый темп',
  },
]

export interface StyleOption {
  value: DialogueStyle
  labelKey: string
  fallbackLabel: string
  icon: string
}

export const STYLE_OPTIONS: StyleOption[] = [
  {
    value: 'adaptive',
    labelKey: 'plugins.dialogue-trainer.styleAdaptive',
    fallbackLabel: 'Адаптивный',
    icon: 'mdi:auto-fix',
  },
  {
    value: 'friendly',
    labelKey: 'plugins.dialogue-trainer.styleFriendly',
    fallbackLabel: 'Дружелюбный',
    icon: 'mdi:emoticon-happy-outline',
  },
  {
    value: 'casual',
    labelKey: 'plugins.dialogue-trainer.styleCasual',
    fallbackLabel: 'Разговорный / Сленг',
    icon: 'mdi:chat-processing-outline',
  },
  {
    value: 'formal',
    labelKey: 'plugins.dialogue-trainer.styleFormal',
    fallbackLabel: 'Официально-деловой',
    icon: 'mdi:briefcase-outline',
  },
  {
    value: 'humorous',
    labelKey: 'plugins.dialogue-trainer.styleHumorous',
    fallbackLabel: 'С юмором',
    icon: 'mdi:drama-masks',
  },
  {
    value: 'tutor',
    labelKey: 'plugins.dialogue-trainer.styleTutor',
    fallbackLabel: 'Терпеливый наставник',
    icon: 'mdi:school-outline',
  },
]

export interface TopicPreset {
  id: string
  titleKey: string
  fallbackTitle: string
  icon: string
}

export const TOPIC_PRESETS: TopicPreset[] = [
  { id: 'coffee', titleKey: 'plugins.dialogue-trainer.topicCoffee', fallbackTitle: 'Заказ в кофейне или ресторане', icon: 'mdi:coffee' },
  { id: 'airport', titleKey: 'plugins.dialogue-trainer.topicAirport', fallbackTitle: 'В аэропорту и на контроле', icon: 'mdi:airplane' },
  { id: 'hotel', titleKey: 'plugins.dialogue-trainer.topicHotel', fallbackTitle: 'Заселение в отель', icon: 'mdi:bed' },
  { id: 'smalltalk', titleKey: 'plugins.dialogue-trainer.topicSmalltalk', fallbackTitle: 'Знакомство и увлечения', icon: 'mdi:account-group' },
  { id: 'interview', titleKey: 'plugins.dialogue-trainer.topicInterview', fallbackTitle: 'Собеседование на работу', icon: 'mdi:tie' },
  { id: 'shopping', titleKey: 'plugins.dialogue-trainer.topicShopping', fallbackTitle: 'Покупки в магазине одежды', icon: 'mdi:shopping' },
  { id: 'doctor', titleKey: 'plugins.dialogue-trainer.topicDoctor', fallbackTitle: 'Визит к врачу / Аптека', icon: 'mdi:medical-bag' },
  { id: 'directions', titleKey: 'plugins.dialogue-trainer.topicDirections', fallbackTitle: 'Как пройти: ориентирование в городе', icon: 'mdi:map-marker-question' },
]
