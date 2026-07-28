import { beforeAll, describe, expect, it } from 'vitest'
import { localePromise } from '~/shared/plugins/i18n'
import { collapsePageRanges, formatBytes, formatCurrency, formatNumber, formatPageRange, formatPagesList } from './formatters'

describe('collapsePageRanges', () => {
  it('возвращает пустой массив для пустого списка', () => {
    expect(collapsePageRanges([])).toEqual([])
  })

  it('одиночная страница остаётся одиночным диапазоном', () => {
    expect(collapsePageRanges([7])).toEqual([{ start: 7, end: 7 }])
  })

  it('схлопывает непрерывные последовательности', () => {
    expect(collapsePageRanges([1, 2, 3, 4, 5])).toEqual([{ start: 1, end: 5 }])
  })

  it('разрывает диапазоны на промежутках', () => {
    expect(collapsePageRanges([1, 2, 3, 5, 6, 10])).toEqual([
      { start: 1, end: 3 },
      { start: 5, end: 6 },
      { start: 10, end: 10 },
    ])
  })

  it('сортирует вход и убирает дубликаты', () => {
    expect(collapsePageRanges([5, 3, 4, 4, 1, 2])).toEqual([{ start: 1, end: 5 }])
  })

  it('корректно работает с большим непрерывным кэшем', () => {
    const pages = Array.from({ length: 630 }, (_, i) => i + 1)
    expect(collapsePageRanges(pages)).toEqual([{ start: 1, end: 630 }])
  })
})

describe('formatPageRange', () => {
  it('одиночная страница без тире', () => {
    expect(formatPageRange({ start: 5, end: 5 })).toBe('5')
  })

  it('диапазон через эн-тире', () => {
    expect(formatPageRange({ start: 12, end: 18 })).toBe('12–18')
  })
})

describe('formatPagesList', () => {
  beforeAll(async () => {
    await localePromise
  })

  it('пустой список — заглушка', () => {
    expect(formatPagesList([])).toBe('Нет сохраненных страниц')
  })

  it('короткий список схлопывается в диапазоны', () => {
    expect(formatPagesList([1, 2, 3, 5, 10])).toBe('1–3, 5, 10')
  })

  it('полностью закэшированная книга — один диапазон', () => {
    const pages = Array.from({ length: 630 }, (_, i) => i + 1)
    expect(formatPagesList(pages)).toBe('1–630')
  })

  it('при избытке диапазонов показывает счётчик остатка', () => {
    // 25 изолированных страниц -> 25 диапазонов, лимит 20
    const pages = Array.from({ length: 25 }, (_, i) => i * 2 + 1)
    const result = formatPagesList(pages)
    expect(result).toContain('1, 3, 5')
    expect(result).toContain('... и ещё 5')
  })
})

describe('formatBytes', () => {
  beforeAll(async () => {
    await localePromise
  })

  it('0 байт — заглушка', () => {
    expect(formatBytes(0)).toBe('0 Байт')
  })

  it('байты без перевода в КБ', () => {
    expect(formatBytes(500)).toBe('500 Байт')
  })

  it('килобайты', () => {
    expect(formatBytes(2048)).toBe('2 КБ')
  })

  it('мегабайты', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 МБ')
  })

  it('гигабайты', () => {
    expect(formatBytes(3 * 1024 ** 3)).toBe('3 ГБ')
  })

  it('дробные значения округляются по decimals', () => {
    expect(formatBytes(1500)).toBe('1.46 КБ')
    expect(formatBytes(1500, 3)).toBe('1.465 КБ')
    expect(formatBytes(1500, 0)).toBe('1 КБ')
  })

  it('отрицательные значения трактуются как 0 Байт', () => {
    expect(formatBytes(-1024)).toBe('0 Байт')
  })
})

describe('formatNumber', () => {
  it('undefined и null — ноль', () => {
    expect(formatNumber(undefined)).toBe('0')
    expect(formatNumber(null)).toBe('0')
  })

  it('обычные числа форматируются в локали ru-RU', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(42)).toBe('42')
    expect(formatNumber(1234567)).toBe('1 234 567')
  })

  it('поддерживает кастомную локаль', () => {
    expect(formatNumber(1234567, 'en-US')).toBe('1,234,567')
  })
})

describe('formatCurrency', () => {
  it('undefined, null и 0 — заглушка', () => {
    expect(formatCurrency(undefined)).toBe('$0.00')
    expect(formatCurrency(null)).toBe('$0.00')
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('обычные числа — в USD с двумя знаками', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
    expect(formatCurrency(1)).toBe('$1.00')
  })

  it('значения меньше цента — четыре знака', () => {
    expect(formatCurrency(0.001)).toBe('$0.0010')
  })
})
