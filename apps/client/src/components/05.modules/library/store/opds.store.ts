import type { OpdsCatalog, OpdsFeed } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { i18n } from '~/shared/plugins/i18n'
import { api } from '~/shared/services/api.service'
import { useToastStore } from '~/shared/store/toast.store'
import { useLibraryStore } from './library.store'

function getCorsProxyUrl(targetUrl: string) {
  return `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
}

export const useOpdsStore = defineStore('opds', () => {
  const catalogs = ref<OpdsCatalog[]>([])
  const isLoading = ref(false)
  const isBrowsing = ref(false)
  const isDownloading = ref(false)
  const currentFeed = ref<OpdsFeed | null>(null)

  async function fetchCatalogs() {
    isLoading.value = true
    try {
      catalogs.value = await api.opds.getCatalogs()
    }
    finally {
      isLoading.value = false
    }
  }

  async function addCatalog(title: string, url: string) {
    const newCatalog = await api.opds.addCatalog({ title, url })
    catalogs.value.push(newCatalog)
  }

  async function deleteCatalog(id: number) {
    await api.opds.deleteCatalog(id)
    catalogs.value = catalogs.value.filter(c => c.id !== id)
  }

  // --- НОВАЯ ЛОГИКА ФРОНТЕНДА ДЛЯ OPDS ---

  async function browse(url: string) {
    isBrowsing.value = true
    try {
      // 1. Скачиваем OPDS через CORS-прокси
      const res = await fetch(getCorsProxyUrl(url), {
        headers: { Accept: 'application/atom+xml,application/xml,text/xml' },
      })
      if (!res.ok)
        throw new Error(`HTTP ${res.status}`)
      const xml = await res.text()

      // 2. Парсим XML встроенным в браузер парсером
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, 'text/xml')

      const title = doc.querySelector('feed > title')?.textContent || 'OPDS Catalog'

      const links: any[] = []
      Array.from(doc.getElementsByTagName('link')).forEach((el) => {
        if (el.parentElement?.tagName.toLowerCase() === 'feed') {
          links.push({
            rel: el.getAttribute('rel'),
            href: new URL(el.getAttribute('href') || '', url).toString(),
            type: el.getAttribute('type'),
            title: el.getAttribute('title'),
          })
        }
      })

      const entries: any[] = []
      Array.from(doc.getElementsByTagName('entry')).forEach((el) => {
        const entryTitle = el.getElementsByTagName('title')[0]?.textContent || 'Без названия'

        const authors: string[] = []
        Array.from(el.getElementsByTagName('author')).forEach((a) => {
          const name = a.getElementsByTagName('name')[0]?.textContent
          if (name)
            authors.push(name)
        })

        const content = el.getElementsByTagName('content')[0]?.textContent
          || el.getElementsByTagName('summary')[0]?.textContent || ''

        const entryLinks: any[] = []
        Array.from(el.getElementsByTagName('link')).forEach((linkEl) => {
          const href = linkEl.getAttribute('href')
          if (href) {
            entryLinks.push({
              rel: linkEl.getAttribute('rel'),
              href: new URL(href, url).toString(),
              type: linkEl.getAttribute('type'),
              title: linkEl.getAttribute('title'),
            })
          }
        })

        entries.push({
          title: entryTitle,
          author: authors.join(', '),
          content,
          links: entryLinks,
        })
      })

      currentFeed.value = { title, links, entries }
    }
    catch (e) {
      useToastStore().error(`Ошибка загрузки: ${e instanceof Error ? e.message : ''}`)
    }
    finally {
      isBrowsing.value = false
    }
  }

  async function downloadBook(downloadUrl: string, title: string, type?: string) {
    isDownloading.value = true
    try {
      // 1. Скачиваем саму книгу в память браузера (в виде Blob)
      const res = await fetch(getCorsProxyUrl(downloadUrl))
      if (!res.ok)
        throw new Error('Ошибка скачивания файла')
      const blob = await res.blob()

      // 2. Определяем расширение
      let ext = '.epub'
      if (type?.includes('epub')) {
        ext = '.epub'
      }
      else if (type?.includes('fb2')) {
        ext = '.fb2'
      }
      else if (type?.includes('cbz') || downloadUrl.includes('.cbz')) {
        ext = '.cbz'
      }
      else if (type?.includes('zip') || downloadUrl.includes('.zip')) {
        if (downloadUrl.includes('fb2'))
          ext = '.fb2'
        else ext = '.zip'
      }

      // eslint-disable-next-line regexp/no-obscure-range
      const filename = `${title.replace(/[^\wА-ЯЁ.-]/gi, '_')}${ext}`
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' })

      const libraryStore = useLibraryStore()
      const book = await libraryStore.uploadBook(file)

      if (book) {
        useToastStore().success(i18n.global.t('opds.bookDownloaded'))
      }
    }
    catch (e) {
      useToastStore().error(e instanceof Error ? e.message : i18n.global.t('opds.downloadError'))
    }
    finally {
      isDownloading.value = false
    }
  }

  return {
    catalogs,
    isLoading,
    isBrowsing,
    isDownloading,
    currentFeed,
    fetchCatalogs,
    addCatalog,
    deleteCatalog,
    browse,
    downloadBook,
  }
})
