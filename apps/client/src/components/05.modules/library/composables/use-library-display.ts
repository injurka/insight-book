import type { Book } from '~/shared/types/models'
import { computed, ref, watch } from 'vue'
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
    const opts = [{ label: 'Все языки', value: 'all' }]
    langs.forEach(l => opts.push({ label: l.toUpperCase(), value: l }))
    return opts
  })

  const displayGroups = computed<DisplayGroup[]>(() => {
    let filtered = store.books.filter((b) => {
      const matchLang = selectedLang.value === 'all' || b.language === selectedLang.value
      const matchSearch = b.title.toLowerCase().includes(searchQuery.value.toLowerCase())
        || (b.author && b.author.toLowerCase().includes(searchQuery.value.toLowerCase()))
      return matchLang && matchSearch
    })

    // Если выбрана конкретная папка, отображаем ее содержимое
    if (activeFolder.value) {
      if (currentView.value === 'authors') {
        filtered = filtered.filter(b => (b.author?.trim() || 'Неизвестный автор') === activeFolder.value)
      }
      else if (currentView.value === 'collections') {
        filtered = filtered.filter(b => (b.collection?.trim() || 'Без коллекции') === activeFolder.value)
      }
      else if (currentView.value === 'series') {
        filtered = filtered.filter(b => (b.series?.trim() || 'Одиночные книги') === activeFolder.value)
      }
      return [{ seriesName: activeFolder.value, isFolderContent: true, books: filtered }]
    }

    // Читаю сейчас
    if (currentView.value === 'reading-now') {
      filtered = filtered.filter(b => b.status === 'reading' || !b.status)
      filtered.sort((a, b) => {
        const tA = new Date(a.progressUpdatedAt || a.updatedAt).getTime()
        const tB = new Date(b.progressUpdatedAt || b.updatedAt).getTime()
        return tB - tA
      })
      return [{ seriesName: 'Читаю сейчас', icon: 'mdi:book-open-page-variant-outline', books: filtered }]
    }

    // Избранное
    if (currentView.value === 'favorites') {
      filtered = filtered.filter(b => b.isFavorite)
      return [{ seriesName: 'Избранное', icon: 'mdi:star-outline', books: filtered }]
    }

    // Хочу прочитать
    if (currentView.value === 'to-read') {
      filtered = filtered.filter(b => b.status === 'to-read')
      return [{ seriesName: 'Хочу прочитать', icon: 'mdi:clock-outline', books: filtered }]
    }

    // Прочитано
    if (currentView.value === 'have-read') {
      filtered = filtered.filter(b => b.status === 'have-read')
      return [{ seriesName: 'Прочитано', icon: 'mdi:check-all', books: filtered }]
    }

    // Все книги
    if (currentView.value === 'books') {
      return [{ seriesName: 'Все книги', icon: 'mdi:book-open-blank-variant', books: filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()) }]
    }

    // Авторы (Папки)
    if (currentView.value === 'authors') {
      const counts: Record<string, number> = {}
      filtered.forEach((b) => {
        const key = b.author?.trim() || 'Неизвестный автор'
        counts[key] = (counts[key] || 0) + 1
      })
      const folders = Object.keys(counts).sort().map(k => ({ name: k, count: counts[k] }))
      return [{ seriesName: 'Авторы', icon: 'mdi:account-group-outline', folders }]
    }

    // Коллекции (Папки)
    if (currentView.value === 'collections') {
      const counts: Record<string, number> = {}
      filtered.forEach((b) => {
        const key = b.collection?.trim() || 'Без коллекции'
        counts[key] = (counts[key] || 0) + 1
      })
      const folders = Object.keys(counts).sort().map(k => ({ name: k, count: counts[k] }))
      return [{ seriesName: 'Коллекции', icon: 'mdi:bookshelf', folders }]
    }

    // Серии (Папки)
    if (currentView.value === 'series') {
      const counts: Record<string, number> = {}
      filtered.forEach((b) => {
        const key = b.series?.trim() || 'Одиночные книги'
        counts[key] = (counts[key] || 0) + 1
      })
      const folders = Object.keys(counts).sort().map(k => ({ name: k, count: counts[k] }))
      return [{ seriesName: 'Серии', icon: 'mdi:folder-outline', folders }]
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
