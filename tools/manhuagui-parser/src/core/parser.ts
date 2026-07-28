import type { Page } from 'puppeteer'
import type { MangaInfo, ChapterGroup, ChapterInfo } from '../types'
import { downloadImageNode } from './downloader'
import { sleep } from '../utils/sleep'
import path from 'node:path'

export async function getMangaInfo(page: Page, mangaUrl: string): Promise<MangaInfo> {
  await page.goto(mangaUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })

  const adultBtn = await page.$('#checkAdult').catch(() => null)
  if (adultBtn) {
    await adultBtn.click()
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => { })
  }

  const title = await page.$eval('.book-title h1', el => el.textContent?.trim() || 'Unknown_Manga').catch(() => 'Unknown_Manga')
  const coverUrl = await page.$eval('.book-cover img', el => el.getAttribute('src') || '').catch(() => '')

  const groups: ChapterGroup[] = await page.evaluate(() => {
    const result: ChapterGroup[] = []

    document.querySelectorAll('.chapter-list').forEach((list, listIndex) => {
      let titleNode = list.previousElementSibling
      while (titleNode && titleNode.tagName !== 'H4') {
        titleNode = titleNode.previousElementSibling
      }
      const mainTitle = titleNode ? (titleNode as HTMLElement).innerText.trim() : `Группа ${listIndex + 1}`

      let pageNode = list.previousElementSibling
      if (pageNode && pageNode.classList.contains('chapter-page')) {
        const tabs = pageNode.querySelectorAll('ul li a')
        const uls = list.querySelectorAll('ul')

        tabs.forEach((tab, tabIdx) => {
          const subTitle = tab.getAttribute('title') || (tab as HTMLElement).innerText.trim()
          const ul = uls[tabIdx]
          if (ul) {
            const links = Array.from(ul.querySelectorAll('li a')).map(a => {
              const anchor = a as HTMLAnchorElement
              return {
                title: anchor.getAttribute('title') || anchor.innerText.trim(),
                url: anchor.href,
                pages: parseInt(anchor.querySelector('i')?.innerText.replace(/\D/g, '') || '0', 10)
              }
            })
            result.push({ name: `${mainTitle} (${subTitle})`, chapters: links.reverse() })
          }
        })
      } else {
        const links = Array.from(list.querySelectorAll('ul li a')).map(a => {
          const anchor = a as HTMLAnchorElement
          return {
            title: anchor.getAttribute('title') || anchor.innerText.trim(),
            url: anchor.href,
            pages: parseInt(anchor.querySelector('i')?.innerText.replace(/\D/g, '') || '0', 10)
          }
        })
        result.push({ name: mainTitle, chapters: links.reverse() })
      }
    })
    return result
  })

  return { title, coverUrl, groups }
}

export async function downloadChapter(
  page: Page,
  chapter: ChapterInfo,
  chapterDir: string,
  onProgress: (p: number, total: number) => void
): Promise<number> {
  await page.goto(chapter.url, { waitUntil: 'domcontentloaded', timeout: 60000 })

  const adultBtn = await page.$('#checkAdult').catch(() => null)
  if (adultBtn) {
    await adultBtn.click()
    await page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => { })
  }

  const mangaFileExists = await page.waitForSelector('#mangaFile', { timeout: 15000 }).then(() => true).catch(() => false)
  if (!mangaFileExists) {
    const errorTxt = await page.$eval('#errorTxt, .errorTxt, .warning, .block-msg', el => el.textContent?.trim()).catch(() => '')
    if (errorTxt) {
      throw new Error(`Сайт вернул ошибку: ${errorTxt}`)
    }
    throw new Error('Элемент #mangaFile не найден на странице. Возможно, работает защита Cloudflare или блокировка региона (нужен VPN).')
  }

  let prevSrc = ''
  const DELAY_BETWEEN_PAGES = 1000
  let downloadedCount = 0

  for (let p = 1; p <= chapter.pages; p++) {
    await page.evaluate((pageNum) => {
      if (typeof (window as any).SMH !== 'undefined' && (window as any).SMH.reader) {
        (window as any).SMH.reader.goto(pageNum)
      } else {
        const select = document.querySelector('#pageSelect') as HTMLSelectElement
        if (select) {
          select.value = pageNum.toString()
          select.dispatchEvent(new Event('change'))
        } else {
          window.location.hash = `#p=${pageNum}`
          window.dispatchEvent(new Event('hashchange'))
        }
      }
    }, p)

    let imgUrl = ''
    for (let retry = 0; retry < 3; retry++) {
      try {
        await page.waitForFunction((prev) => {
          const img = document.querySelector('#mangaFile') as HTMLImageElement
          return img && img.src &&
            !img.src.includes('loading.gif') &&
            !img.src.includes('pixel.gif') &&
            !img.src.includes('none.gif') &&
            img.src !== prev
        }, { timeout: 15000 }, prevSrc)

        imgUrl = await page.$eval('#mangaFile', (el) => (el as HTMLImageElement).src).catch(() => '')
        if (imgUrl && !imgUrl.includes('loading.gif')) break
      } catch {
        imgUrl = await page.$eval('#mangaFile', (el) => (el as HTMLImageElement).src).catch(() => '')
        if (imgUrl && !imgUrl.includes('loading.gif') && imgUrl !== prevSrc) break

        await page.evaluate((pageNum) => {
          if (typeof (window as any).SMH !== 'undefined' && (window as any).SMH.reader) {
            (window as any).SMH.reader.goto(pageNum)
          } else {
            window.location.hash = `#p=${pageNum}`
            window.dispatchEvent(new Event('hashchange'))
          }
        }, p)
        await sleep(2000)
      }
    }

    prevSrc = imgUrl

    if (!imgUrl || imgUrl.includes('loading.gif')) {
      throw new Error(`Не удалось получить ссылку для страницы ${p}`)
    }

    if (imgUrl.startsWith('//')) {
      imgUrl = 'https:' + imgUrl
    } else if (imgUrl.startsWith('/')) {
      imgUrl = 'https://www.manhuagui.com' + imgUrl
    }

    const pageFileName = `page_${p.toString().padStart(3, '0')}`
    const savePathWithoutExt = path.join(chapterDir, pageFileName)

    await downloadImageNode(imgUrl, savePathWithoutExt, page.url())
    downloadedCount++

    onProgress(p, chapter.pages)
    await sleep(DELAY_BETWEEN_PAGES)
  }

  return downloadedCount
}
