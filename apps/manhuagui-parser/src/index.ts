import { intro, outro, text, select, multiselect, spinner, isCancel, cancel, log } from '@clack/prompts'
import pc from 'picocolors'
import process from 'node:process'
import path from 'node:path'
import { mkdirSync } from 'node:fs'

import { launchBrowser } from './core/browser'
import { getMangaInfo, downloadChapter } from './core/parser'
import { packToCbz } from './core/zipper'
import { downloadImageNode } from './core/downloader'

const DOWNLOADS_DIR = path.resolve(process.cwd(), 'downloads')

async function main() {
  intro(pc.bgCyan(pc.black(' 📖 Manhuagui Parser ')))

  let targetUrl = process.argv[2]
  if (!targetUrl) {
    const urlPrompt = await text({
      message: 'Введите URL манги:',
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

    const selectedGroups = (selectedIndices as number[]).map(i => mangaInfo.groups[i])
    const chaptersToDownload = selectedGroups.flatMap(g => g.chapters).filter(c => c.pages > 0)

    // --- НОВЫЙ ШАГ: ВЫБОР ДИАПАЗОНА ГЛАВ ---
    const rangePrompt = await text({
      message: `Выбрано ${chaptersToDownload.length} глав. Введите диапазон (например: 1-10, 5) или оставьте пустым для скачивания всех:`,
      placeholder: `1-${chaptersToDownload.length}`,
      validate(value) {
        if (!value.trim()) return // Если пусто — пропускаем (значит качаем всё)
        const match = value.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
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
    // ---------------------------------------

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

    // Подготовка директорий
    const safeTitle = mangaInfo.title.replace(/[^\wА-Яа-я0-9 \-]/gi, '_')
    const mangaDir = path.join(DOWNLOADS_DIR, safeTitle)
    mkdirSync(mangaDir, { recursive: true })

    if (mangaInfo.coverUrl) {
      const fullCoverUrl = mangaInfo.coverUrl.startsWith('//') ? `https:${mangaInfo.coverUrl}` : mangaInfo.coverUrl
      await downloadImageNode(fullCoverUrl, path.join(mangaDir, 'cover.jpg'), targetUrl).catch(() => {
        log.warn('Не удалось скачать обложку')
      })
    }

    log.info(`Всего будет скачано глав: ${finalChapters.length}`)

    // Процесс скачивания
    for (const [idx, chapter] of finalChapters.entries()) {
      const safeChapterTitle = chapter.title.replace(/[^\wА-Яа-я0-9 \-]/gi, '_')
      const chapterDir = path.join(mangaDir, safeChapterTitle)
      mkdirSync(chapterDir, { recursive: true })

      s.start(`[${idx + 1}/${finalChapters.length}] Скачивается: ${chapter.title} (0/${chapter.pages} стр.)`)

      try {
        await downloadChapter(page, chapter, chapterDir, (p, total) => {
          s.message(`[${idx + 1}/${finalChapters.length}] Скачивается: ${chapter.title} (${p}/${total} стр.)`)
        })
        s.stop(`✅ [${idx + 1}/${finalChapters.length}] Глава "${chapter.title}" скачана.`)
      } catch (err: any) {
        s.stop(`❌ Ошибка в главе "${chapter.title}": ${err.message}`)
        log.warn(`Глава ${chapter.title} была пропущена из-за ошибки.`)
      }
    }

    if (isCbz) {
      s.start('Упаковка в CBZ архив...')
      const cbzPath = packToCbz(mangaDir, DOWNLOADS_DIR, safeTitle)
      s.stop(`📦 Архив сохранен: ${cbzPath}`)
    } else {
      log.success(`📁 Манга сохранена в папку: ${mangaDir}`)
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
