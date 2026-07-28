import { intro, outro, text, select, multiselect, spinner, isCancel, cancel, log } from '@clack/prompts'
import pc from 'picocolors'
import process from 'node:process'
import path from 'node:path'
import { mkdirSync, readFileSync, existsSync } from 'node:fs'

import { launchBrowser } from './core/browser'
import { getMangaInfo, downloadChapter } from './core/parser'
import { packToCbz } from './core/zipper'
import { downloadImageNode } from './core/downloader'
import { writeComicInfo, BookmarkInfo } from './core/metadata'
import { parseMangaConfig } from './utils/config'
import type { MangaConfig } from './types'

const DOWNLOADS_DIR = path.resolve(process.cwd(), 'downloads')

function getTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
}

async function main() {
  intro(pc.bgCyan(pc.black(' 📖 Manhuagui Parser ')))

  let targetArg = process.argv[2]
  let targetUrl: string | undefined
  let autoConfig: MangaConfig | undefined

  if (targetArg && targetArg.toLowerCase().endsWith('.json')) {
    const fullPath = path.resolve(process.cwd(), targetArg)
    if (!existsSync(fullPath)) {
      cancel(`Файл конфига не найден: ${fullPath}`)
      process.exit(1)
    }
    try {
      const content = readFileSync(fullPath, 'utf-8')
      autoConfig = parseMangaConfig(content)
      targetUrl = autoConfig.url
    } catch (err: any) {
      cancel(`❌ Ошибка чтения конфига: ${err.message}`)
      process.exit(1)
    }
  } else {
    targetUrl = targetArg
  }

  if (!targetUrl) {
    const urlPrompt = await text({
      message: autoConfig
        ? 'URL не найден в JSON-конфиге. Введите URL манги вручную:'
        : 'Введите URL манги (или путь к .json конфигу):',
      placeholder: 'https://www.manhuagui.com/comic/19430/',
      validate(value) {
        if (!value!.trim()) return 'Обязательное поле'
        if (!value!.includes('manhuagui.com')) return 'Пожалуйста, введите корректный URL manhuagui.com'
      }
    })

    if (isCancel(urlPrompt)) {
      cancel('Операция отменена.')
      process.exit(0)
    }
    targetUrl = urlPrompt as string
  }

  const s = spinner()
  s.start('Запуск браузера и обход защиты...')

  const { browser, page } = await launchBrowser()

  try {
    s.message(`Открываем: ${targetUrl}`)
    const mangaInfo = await getMangaInfo(page, targetUrl)

    if (mangaInfo.groups.length === 0) {
      s.stop('❌ Главы не найдены.')
      cancel('Возможно, сайт требует капчу или изменил верстку.')
      return
    }

    s.stop(`📚 Найдена манга: ${pc.green(mangaInfo.title)}`)

    let selectedGroups: typeof mangaInfo.groups = []

    // Автоматический выбор групп на основе конфига
    if (autoConfig && autoConfig.groups && autoConfig.groups.length > 0) {
      const filters = autoConfig.groups
      selectedGroups = mangaInfo.groups.filter(g =>
        filters.some(filter => g.name.toLowerCase().includes(filter.toLowerCase()))
      )

      if (selectedGroups.length === 0) {
        log.warn('⚠️ Заданные в конфиге группы не найдены на странице. Выберите их вручную.')
      } else {
        log.info(`⚙️ Автоматически выбрано групп: ${pc.cyan(selectedGroups.map(g => g.name).join(', '))}`)
      }
    }

    // Если автовыбор не сработал или конфиг не использовался — спрашиваем вручную
    if (selectedGroups.length === 0) {
      const groupOptions = mangaInfo.groups.map((g, idx) => ({
        value: idx,
        label: `${g.name} (${g.chapters.length} глав)`
      }))

      const selectedIndices = await multiselect({
        message: 'Выберите группы для скачивания (Space для выбора, Enter для подтверждения):',
        options: groupOptions,
        required: true,
      })

      if (isCancel(selectedIndices)) {
        cancel('Отменено.')
        return
      }

      selectedGroups = (selectedIndices as number[]).map(i => mangaInfo.groups[i])
    }

    const chaptersToDownload = selectedGroups.flatMap(g => g.chapters).filter(c => c.pages > 0)

    let batches: { title: string; chapters: typeof chaptersToDownload }[] = []
    let finalSeriesName = mangaInfo.title
    let mode: string

    if (autoConfig) {
      mode = 'split'
      log.info('⚙️ Используется предзагруженный JSON-конфиг для разбивки на тома.')
    } else {
      const modePrompt = await select({
        message: 'Как скачивать выбранные главы?',
        options: [
          { value: 'single', label: 'Одной пачкой (обычный режим)' },
          { value: 'split', label: 'Разбить на тома/арки по строгому JSON-конфигу' }
        ]
      })
      if (isCancel(modePrompt)) {
        cancel('Отменено.')
        return
      }
      mode = modePrompt as string
    }

    if (mode === 'split') {
      let config = autoConfig
      if (!config) {
        const configPath = await text({
          message: 'Укажите путь к JSON-файлу конфига (например, config.json):',
          placeholder: './config.json',
          validate(val) {
            if (!val!.trim()) return 'Путь не может быть пустым'
            if (!existsSync(path.resolve(process.cwd(), val!.trim()))) {
              return 'Файл не найден'
            }
          }
        })

        if (isCancel(configPath)) {
          cancel('Отменено.')
          return
        }

        const fullPath = path.resolve(process.cwd(), (configPath as string).trim())
        const content = readFileSync(fullPath, 'utf-8')

        try {
          config = parseMangaConfig(content)
        } catch (err: any) {
          cancel(`❌ Ошибка чтения конфига: ${err.message}`)
          return
        }
      }

      if (config.volumes.length === 0) {
        cancel('❌ Конфиг валиден, но массив "volumes" пуст.')
        return
      }

      if (config.series) {
        finalSeriesName = config.series
      }

      log.info(`✅ Успешно распарсено томов: ${config.volumes.length}`)

      for (const vol of config.volumes) {
        const startIdx = vol.start - 1
        const endIdx = vol.end
        const volChapters = chaptersToDownload.slice(Math.max(0, startIdx), Math.min(chaptersToDownload.length, endIdx))

        if (volChapters.length > 0) {
          batches.push({
            title: vol.title,
            chapters: volChapters
          })
        } else {
          log.warn(`⚠️ Том "${vol.title}" пропущен (главы ${vol.start}-${vol.end} вне диапазона выбранных групп)`)
        }
      }

      if (batches.length === 0) {
        cancel('❌ Ни один том не содержит валидных глав для скачивания из выбранных групп.')
        return
      }
    } else {
      const rangePrompt = await text({
        message: `Выбрано ${chaptersToDownload.length} глав. Введите диапазон (например: 1-10, 5) или оставьте пустым для скачивания всех:`,
        placeholder: `1-${chaptersToDownload.length}`,
        validate(value) {
          if (!value!.trim()) return
          const match = value!.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
          if (!match) return 'Введите в формате "Начало-Конец" (например: 1-5) или просто одно число'

          const start = parseInt(match[1], 10)
          const end = match[2] ? parseInt(match[2], 10) : start

          if (start < 1 || start > chaptersToDownload.length || end < 1 || end > chaptersToDownload.length || start > end) {
            return `Допустимый диапазон: от 1 до ${chaptersToDownload.length}`
          }
        }
      })

      if (isCancel(rangePrompt)) {
        cancel('Отменено.')
        return
      }

      let finalChapters = chaptersToDownload
      if ((rangePrompt as string).trim()) {
        const match = (rangePrompt as string).match(/^(\d+)(?:\s*-\s*(\d+))?$/)!
        const start = parseInt(match[1], 10) - 1
        const end = match[2] ? parseInt(match[2], 10) : start + 1
        finalChapters = chaptersToDownload.slice(start, end)
      }

      batches.push({
        title: getTimestamp(),
        chapters: finalChapters
      })
    }

    const format = await select({
      message: 'Выберите формат вывода:',
      options: [
        { value: 'cbz', label: 'CBZ архив', hint: 'удобно для Insight Book' },
        { value: 'folder', label: 'Обычная папка с изображениями' }
      ]
    })

    if (isCancel(format)) {
      cancel('Отменено.')
      return
    }

    const isCbz = format === 'cbz'
    const safeTitle = finalSeriesName.replace(/[^\wА-Яа-я0-9 \-]/gi, '_')
    const baseMangaDir = path.join(DOWNLOADS_DIR, safeTitle)

    log.info(`🚀 Всего будет скачано частей/томов: ${batches.length}`)

    for (const [batchIdx, batch] of batches.entries()) {
      const batchTitleSafe = batch.title.replace(/[^\wА-Яа-я0-9 \-]/gi, '_')
      const mangaDir = path.join(baseMangaDir, batchTitleSafe)

      mkdirSync(mangaDir, { recursive: true })

      log.info(`\n📦 [${batchIdx + 1}/${batches.length}] Подготовка: ${batch.title} (${batch.chapters.length} глав)`)

      let globalPageCounter = 0
      const bookmarks: BookmarkInfo[] = []

      // Скачиваем обложку
      if (mangaInfo.coverUrl) {
        const fullCoverUrl = mangaInfo.coverUrl.startsWith('//') ? `https:${mangaInfo.coverUrl}` : mangaInfo.coverUrl
        try {
          await downloadImageNode(fullCoverUrl, path.join(mangaDir, '000_cover'), targetUrl)
          globalPageCounter++
        } catch (err) {
          log.warn(`Не удалось скачать обложку для ${batch.title}`)
        }
      }

      for (const [idx, chapter] of batch.chapters.entries()) {
        const folderPrefix = String(idx + 1).padStart(3, '0')
        const safeChapterTitle = chapter.title.replace(/[^\wА-Яа-я0-9 \-]/gi, '_')
        const chapterDirName = `${folderPrefix}_${safeChapterTitle}`
        const chapterDir = path.join(mangaDir, chapterDirName)

        mkdirSync(chapterDir, { recursive: true })

        bookmarks.push({
          pageIndex: globalPageCounter,
          title: chapter.title
        })

        s.start(`[${idx + 1}/${batch.chapters.length}] Скачивается: ${chapter.title} (0/${chapter.pages} стр.)`)

        try {
          const downloadedPages = await downloadChapter(page, chapter, chapterDir, (p, total) => {
            s.message(`[${idx + 1}/${batch.chapters.length}] Скачивается: ${chapter.title} (${p}/${total} стр.)`)
          })
          globalPageCounter += downloadedPages
          s.stop(`✅ [${idx + 1}/${batch.chapters.length}] Глава "${chapter.title}" скачана.`)
        } catch (err: any) {
          s.stop(`❌ Ошибка в главе "${chapter.title}": ${err.message}`)
          log.warn(`Глава ${chapter.title} была пропущена из-за ошибки.`)
        }
      }

      const comicInfoTitle = mode === 'split' ? `${finalSeriesName} - ${batch.title}` : finalSeriesName
      writeComicInfo(mangaDir, comicInfoTitle, globalPageCounter, bookmarks)

      if (isCbz) {
        s.start(`Упаковка ${batch.title} в CBZ архив...`)
        const cbzPath = packToCbz(mangaDir, baseMangaDir, batchTitleSafe)
        s.stop(`📦 Архив сохранен: ${cbzPath}`)
      } else {
        log.success(`📁 Манга сохранена в папку: ${mangaDir}`)
      }
    }

    outro(pc.green('🎉 Работа успешно завершена!'))
  } catch (error: any) {
    s.stop('❌ Произошла ошибка')
    cancel(error.message || String(error))
  } finally {
    await browser.close()
  }
}

main()
