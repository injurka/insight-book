export type SubscriptionTierId = 'free' | 'base' | 'advanced' | 'premium'

export interface SubscriptionTier {
  id: SubscriptionTierId
  name: string
  badge: string
  price: number // Рублей в месяц
  dailyTokenLimit: number | null
  dailyBookLimit: number | null
  description: string
  suitableFor: string
  features: string[]
  isPopular?: boolean
  gradient: string
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTierId, SubscriptionTier> = {
  free: {
    id: 'free',
    name: 'Бесплатный',
    badge: '🌱 Free',
    price: 0,
    dailyTokenLimit: 100_000,
    dailyBookLimit: 1,
    description: 'Стартовый доступ для знакомства с возможностями ридера и тестирования ИИ-переводчика.',
    suitableFor: 'Базовое ознакомление с платформой',
    features: [
      '100 000 токенов в день',
      '1 книга в день',
      'Базовый ИИ-словарь и контекстный перевод',
      'Ограниченная озвучка и генерация примеров',
    ],
    gradient: 'linear-gradient(135deg, rgba(148, 163, 184, 0.15), rgba(71, 85, 105, 0.05))',
  },
  base: {
    id: 'base',
    name: 'Базовая подписка',
    badge: '🥉 Bronze',
    price: 150,
    dailyTokenLimit: 250_000,
    dailyBookLimit: 2,
    description: 'Покроет расходы на сервер и даст функционал для ежедневного комфортного чтения с ИИ-словарем.',
    suitableFor: 'Чтение 1-2 книг в месяц, перевод ~1000-1500 предложений, 1-2 тома манги (OCR).',
    features: [
      '250 000 токенов в день',
      '2 книги в день',
      '~1000–1500 разборов предложений в месяц',
      'Генерация примеров и базовых карточек',
      'Поддержка чтения манги (OCR) до 1-2 томов',
    ],
    gradient: 'linear-gradient(135deg, rgba(217, 119, 6, 0.15), rgba(180, 83, 9, 0.05))',
  },
  advanced: {
    id: 'advanced',
    name: 'Продвинутая подписка',
    badge: '🥈 Silver',
    price: 350,
    dailyTokenLimit: 700_000,
    dailyBookLimit: 4,
    description: 'Основной тариф для активных учеников: комфортное чтение, ИИ-озвучка (TTS) и OCR для манги.',
    suitableFor: 'Активное чтение (3-5 томов манги), ~4000-5000 глубоких разборов фраз, ИИ-чат и тесты.',
    isPopular: true,
    features: [
      '700 000 токенов в день',
      '4 книги в день',
      '~4000–5000 глубоких разборов фраз',
      'Комфортное чтение 3–5 томов манги в месяц',
      'Активный чат с ИИ и генерация тестов (Deep Dive)',
      'Поддержка генерации голоса (TTS)',
    ],
    gradient: 'linear-gradient(135deg, rgba(148, 163, 184, 0.25), rgba(51, 65, 85, 0.1))',
  },
  premium: {
    id: 'premium',
    name: 'Премиум подписка',
    badge: '🥇 Gold',
    price: 950,
    dailyTokenLimit: 2_000_000,
    dailyBookLimit: 10,
    description: 'Для «хардкорных» пользователей, которые много читают, генерируют аудио и добавляют десятки книг.',
    suitableFor: 'Практически безлимитный текстовый ИИ, тяжелые учебники, сотни страниц манги.',
    features: [
      '2 000 000 токенов в день',
      '10 книг в день',
      'Практически безлимитный текстовый ИИ',
      'Загрузка тяжелых учебников и сотен страниц манги',
      'Приоритетная генерация аудио и максимальные лимиты',
      'Персональная поддержка',
    ],
    gradient: 'linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(202, 138, 4, 0.08))',
  },
}
