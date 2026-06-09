import type { Book } from '~/shared/types/models'
import { computed, ref, watch } from 'vue'
import { i18n } from '~/shared/plugins/i18n'
import { useLibraryStore } from '../store/library.store'

export interface DisplayGroup {
  seriesName: string
  isFolderContent?: boolean
  icon?: string
  books?: Book[]
  folders?: { name: string, count: number }[]
}

export function useLibraryDisplay() {
  const store = useLibraryStore()

  const searchQuery = ref('')
  const selectedLang = ref('all')
  const currentView = ref('reading-now')
  const activeFolder = ref<string | null>(null)

  watch(currentView, () => {
    activeFolder.value = null
  })

  const langOptions = computed(() => {
    const langs = new Set(store.books.map(b => b.language))
    const opts = [{ label: i18n.global.t('library.allLanguages'), value: 'all' }]
    langs.forEach((l) => {
      const key = `library.lang${l.charAt(0).toUpperCase() + l.slice(1)}`
      const translated = i18n.global.t(key)
      opts.push({ label: translated !== key ? translated : l.toUpperCase(), value: l })
    })
    return opts
  })

  const displayGroups = computed<DisplayGroup[]>(() => {
    const t = i18n.global.t
    let filtered = store.books.filter((b) => {
      const matchLang = selectedLang.value === 'all' || b.language === selectedLang.value
      const matchSearch = b.title.toLowerCase().includes(searchQuery.value.toLowerCase())
        || (b.author && b.author.toLowerCase().includes(searchQuery.value.toLowerCase()))
      return matchLang && matchSearch
    })

    if (activeFolder.value) {
      if (currentView.value === 'authors') {
        filtered = filtered.filter(b => (b.author?.trim() || t('library.unknownAuthor')) === activeFolder.value)
      }
      else if (currentView.value === 'collections') {
        filtered = filtered.filter(b => (b.collection?.trim() || t('library.noCollection')) === activeFolder.value)
      }
      else if (currentView.value === 'series') {
        filtered = filtered.filter(b => (b.series?.trim() || t('library.singleBooks')) === activeFolder.value)
      }
      return [{ seriesName: activeFolder.value, isFolderContent: true, books: filtered }]
    }

    if (currentView.value === 'reading-now') {
      filtered = filtered.filter(b => b.status === 'reading' || !b.status)
      filtered.sort((a, b) => {
        const tA = new Date(a.progressUpdatedAt || a.updatedAt || 0).getTime()
        const tB = new Date(b.progressUpdatedAt || b.updatedAt || 0).getTime()
        return tB - tA
      })
      return [{ seriesName: t('library.menuReadingNow'), icon: 'mdi:book-open-page-variant-outline', books: filtered }]
    }

    if (currentView.value === 'favorites') {
      filtered = filtered.filter(b => b.isFavorite)
      return [{ seriesName: t('library.menuFavorites'), icon: 'mdi:star-outline', books: filtered }]
    }

    if (currentView.value === 'to-read') {
      filtered = filtered.filter(b => b.status === 'to-read')
      return [{ seriesName: t('library.menuToRead'), icon: 'mdi:clock-outline', books: filtered }]
    }

    if (currentView.value === 'have-read') {
      filtered = filtered.filter(b => b.status === 'have-read')
      return [{ seriesName: t('library.menuHaveRead'), icon: 'mdi:check-all', books: filtered }]
    }

    if (currentView.value === 'books') {
      return [{ seriesName: t('library.menuBooks'), icon: 'mdi:book-open-blank-variant', books: filtered.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()) }]
    }

    if (currentView.value === 'authors') {
      const counts: Record<string, number> = {}
      filtered.forEach((b) => {
        const key = b.author?.trim() || t('library.unknownAuthor')
        counts[key] = (counts[key] || 0) + 1
      })
      const folders = Object.keys(counts).sort().map(k => ({ name: k, count: counts[k] }))
      return [{ seriesName: t('library.menuAuthors'), icon: 'mdi:account-group-outline', folders }]
    }

    if (currentView.value === 'collections') {
      const counts: Record<string, number> = {}
      filtered.forEach((b) => {
        const key = b.collection?.trim() || t('library.noCollection')
        counts[key] = (counts[key] || 0) + 1
      })
      const folders = Object.keys(counts).sort().map(k => ({ name: k, count: counts[k] }))
      return [{ seriesName: t('library.menuCollections'), icon: 'mdi:bookshelf', folders }]
    }

    if (currentView.value === 'series') {
      const counts: Record<string, number> = {}
      filtered.forEach((b) => {
        const key = b.series?.trim() || t('library.singleBooks')
        counts[key] = (counts[key] || 0) + 1
      })
      const folders = Object.keys(counts).sort().map(k => ({ name: k, count: counts[k] }))
      return [{ seriesName: t('library.menuSeries'), icon: 'mdi:folder-outline', folders }]
    }

    return []
  })

  return {
    searchQuery,
    selectedLang,
    currentView,
    activeFolder,
    langOptions,
    displayGroups,
  }
}
