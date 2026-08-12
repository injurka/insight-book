/**
 * Дефолтные тарифы подписки, локализованные на en/ru/zh.
 * Используются сервисом subscription-tier.service для первичного сида таблицы subscription_tiers.
 * Источники текстов: apps/client/src/01.shared/locales/{en,ru,zh}.json (секция subscriptions.tiers)
 * и apps/client/src/01.shared/constants/subscriptions.ts (иконки, лимиты, цвета).
 */
export type SubscriptionLang = 'en' | 'ru' | 'zh'

export const SUBSCRIPTION_LANGS: SubscriptionLang[] = ['en', 'ru', 'zh']

export interface LocalizedTexts {
  en: string
  ru: string
  zh: string
}

export interface SubscriptionTierSeed {
  id: string
  sortOrder: number
  icon: string
  badge: LocalizedTexts
  name: LocalizedTexts
  price: number
  dailyTokenLimit: number | null
  dailyBookLimit: number | null
  description: LocalizedTexts
  features: Record<SubscriptionLang, string[]>
  isPopular: boolean
  gradient: string
  accentColor: string
}

export const SUBSCRIPTION_TIERS_SEED: SubscriptionTierSeed[] = [
  {
    id: 'free',
    sortOrder: 0,
    icon: 'mdi:leaf',
    badge: { en: '🌱 Free', ru: '🌱 Бесплатно', zh: '🌱 免费' },
    name: { en: 'Starter (Free)', ru: 'Стартовый (Free)', zh: '新手体验 (Free)' },
    price: 0,
    dailyTokenLimit: 100_000,
    dailyBookLimit: 1,
    description: {
      en: 'Basic access to try out reader features',
      ru: 'Базовый доступ для знакомства с возможностями ридера',
      zh: '体验阅读器基础功能',
    },
    features: {
      en: [
        '100,000 tokens per day',
        '1 book in daily limit',
        'Basic AI dictionary and context translation',
        'Standard word pronunciation',
      ],
      ru: [
        '100 000 токенов в день',
        '1 книга в дневном лимите',
        'Базовый ИИ-словарь и контекстный перевод',
        'Доступ к стандартной озвучке слов',
      ],
      zh: [
        '每日 100,000 Token',
        '每日 1 本书额度',
        '基础 AI 词典与上下文翻译',
        '标准单词发音',
      ],
    },
    isPopular: false,
    gradient: 'linear-gradient(135deg, rgba(148, 163, 184, 0.12), rgba(71, 85, 105, 0.04))',
    accentColor: '#94a3b8',
  },
  {
    id: 'base',
    sortOrder: 1,
    icon: 'mdi:medal',
    badge: { en: '🥉 Basic', ru: '🥉 Базовый', zh: '🥉 基础' },
    name: { en: 'Basic Subscription', ru: 'Базовая подписка', zh: '基础订阅' },
    price: 150,
    dailyTokenLimit: 250_000,
    dailyBookLimit: 2,
    description: {
      en: 'Covers server expenses for daily reading with AI dictionary',
      ru: 'Покроет расходы сервера и даст ежедневное комфортное чтение с ИИ-словарем',
      zh: '覆盖服务器成本，满足每日舒适阅读与 AI 词典',
    },
    features: {
      en: [
        '250,000 tokens per day',
        '2 books in daily limit',
        '~1000–1500 sentence analyses per month',
        'Example generation and flashcard creation',
        'Manga reading (OCR) up to 1-2 volumes',
      ],
      ru: [
        '250 000 токенов в день',
        '2 книги в дневном лимите',
        '~1000–1500 разборов предложений в месяц',
        'Генерация примеров и базовых карточек',
        'Чтение манги (OCR) до 1-2 томов',
      ],
      zh: [
        '每日 250,000 Token',
        '每日 2 本书额度',
        '每月约 1000–1500 次句子解析',
        '生成例句与基础卡片',
        '漫画阅读 (OCR) 最多 1-2 卷',
      ],
    },
    isPopular: false,
    gradient: 'linear-gradient(135deg, rgba(217, 119, 6, 0.15), rgba(180, 83, 9, 0.05))',
    accentColor: '#d97706',
  },
  {
    id: 'advanced',
    sortOrder: 2,
    icon: 'mdi:star-four-points',
    badge: { en: '🥈 Advanced', ru: '🥈 Продвинутый', zh: '🥈 进阶' },
    name: { en: 'Advanced Subscription', ru: 'Продвинутая подписка', zh: '进阶订阅' },
    price: 350,
    dailyTokenLimit: 700_000,
    dailyBookLimit: 4,
    description: {
      en: 'Main plan for active learners: comfortable reading, TTS, and Manga OCR',
      ru: 'Основной тариф для активных учеников: комфортное чтение, TTS и OCR манги',
      zh: '积极学习者的主推套餐: 舒适阅读、TTS 朗读与漫画 OCR',
    },
    features: {
      en: [
        '700,000 tokens per day',
        '4 books in daily limit',
        '~4000–5000 deep phrase analyses',
        'Comfortable reading of 3–5 manga volumes/mo',
        'Active AI chat and quiz generation',
        'Full TTS voice generation',
      ],
      ru: [
        '700 000 токенов в день',
        '4 книги в дневном лимите',
        '~4000–5000 глубоких разборов фраз',
        'Комфортное чтение 3–5 томов манги в месяц',
        'Активный ИИ-чат и генерация тестов',
        'Использование озвучки (TTS)',
      ],
      zh: [
        '每日 700,000 Token',
        '每日 4 本书额度',
        '每月约 4000–5000 次深度短语解析',
        '每月轻松阅读 3–5 卷漫画',
        '活跃 AI 对话与测试生成',
        '完整 TTS 语音朗读支持',
      ],
    },
    isPopular: true,
    gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.1))',
    accentColor: '#3b82f6',
  },
  {
    id: 'premium',
    sortOrder: 3,
    icon: 'mdi:crown',
    badge: { en: '🥇 Premium', ru: '🥇 Премиум', zh: '🥇 尊享' },
    name: { en: 'Premium Subscription', ru: 'Премиум подписка', zh: '尊享 Premium' },
    price: 950,
    dailyTokenLimit: 2_000_000,
    dailyBookLimit: 10,
    description: {
      en: 'For hardcore users: heavy reading, TTS, and manga',
      ru: 'Для «хардкорных» пользователей: много аудио, книг и манги',
      zh: '面向硬核读者: 大量音频、书籍与漫画',
    },
    features: {
      en: [
        '2,000,000 tokens per day',
        '10 books in daily limit',
        'Practically unlimited text AI',
        'Heavy textbooks and hundreds of manga pages',
        'Highest priority and limits',
      ],
      ru: [
        '2 000 000 токенов в день',
        '10 книг в дневном лимите',
        'Практически безлимитный текстовый ИИ',
        'Тяжелые учебники и сотни страниц манги',
        'Максимальный приоритет и лимиты',
      ],
      zh: [
        '每日 2,000,000 Token',
        '每日 10 本书额度',
        '近乎无限制的文本 AI',
        '加载大部头教材与数百页漫画',
        '最高优先级与额度',
      ],
    },
    isPopular: false,
    gradient: 'linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(245, 158, 11, 0.1))',
    accentColor: '#eab308',
  },
]
