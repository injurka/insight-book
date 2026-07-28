import type { MangaConfig, VolumeConfig } from '../types'

export function parseMangaConfig(content: string): MangaConfig {
  let parsed: any

  try {
    parsed = JSON.parse(content)
  } catch (e) {
    throw new Error('Файл не является валидным JSON.')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Конфиг должен быть JSON-объектом (начинаться с фигурной скобки { ... }).')
  }

  if (!Array.isArray(parsed.volumes)) {
    throw new Error('Отсутствует или имеет неверный формат обязательное поле "volumes". Это должен быть массив.')
  }

  const volumes: VolumeConfig[] = parsed.volumes.map((v: any, index: number) => {
    if (!v.title || typeof v.title !== 'string') {
      throw new Error(`Ошибка в томе по индексу [${index}]: отсутствует или неверный тип "title".`)
    }
    if (typeof v.start !== 'number' || typeof v.end !== 'number') {
      throw new Error(`Ошибка в "${v.title}": поля "start" и "end" обязательны и должны быть числами.`)
    }
    if (v.start > v.end) {
      throw new Error(`Ошибка в "${v.title}": значение "start" (${v.start}) не может быть больше "end" (${v.end}).`)
    }

    return {
      title: v.title,
      start: v.start,
      end: v.end,
      description: typeof v.description === 'string' ? v.description : undefined
    }
  })

  return {
    url: typeof parsed.url === 'string' ? parsed.url : undefined,
    series: typeof parsed.series === 'string' ? parsed.series : undefined,
    groups: Array.isArray(parsed.groups) ? parsed.groups.filter((g: any) => typeof g === 'string') : undefined,
    volumes
  }
}
