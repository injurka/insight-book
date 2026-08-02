import type { DisplayGroup } from '../model'
import { i18n } from '~/00.plugins/i18n'
import { useLibraryStore } from '../store/library.store'

export function useLibraryDisplay() {
  const store = useLibraryStore()
  const route = useRoute()
  const router = useRouter()

  const searchQuery = ref((route.query.q as string) || '')
  const selectedLang = ref((route.query.lang as string) || 'all')
  const currentView = ref((route.query.view as string) || 'reading-now')
  const activeFolder = ref<string | null>((route.query.folder as string) || null)

  const isSyncing = ref(false)

  // 1. Синхронизируем состояние приложения с URL при навигации "вперед/назад"
  watch(() => route.query, (query) => {
    isSyncing.value = true
    currentView.value = (query.view as string) || 'reading-now'
    activeFolder.value = (query.folder as string) || null
    searchQuery.value = (query.q as string) || ''
    selectedLang.value = (query.lang as string) || 'all'

    // Снимаем блокировку после того как все локальные вотчеры отработают
    nextTick(() => {
      isSyncing.value = false
    })
  }, { immediate: true })

  // 2. Сбрасываем папку, если пользователь вручную кликает на другой раздел
  watch(currentView, (newView, oldView) => {
    if (!isSyncing.value && newView !== oldView)
      activeFolder.value = null
  })

  // 3. Обновляем URL, если пользователь производит изменения в UI
  watch([currentView, activeFolder, searchQuery, selectedLang], ([view, folder, searchVal, langCode]) => {
    if (isSyncing.value)
      return

    const query: Record<string, any> = { ...route.query }

    if (view === 'reading-now')
      delete query.view
    else
      query.view = view

    if (folder)
      query.folder = folder
    else
      delete query.folder

    if (searchVal)
      query.q = searchVal
    else
      delete query.q

    if (langCode && langCode !== 'all')
      query.lang = langCode
    else
      delete query.lang

    router.replace({ query })
  }, { deep: true })

  const langOptions = computed(() => {
    const langs = new Set(store.books.map(book => book.language))
    const opts = [{ label: i18n.global.t('library.allLanguages'), value: 'all' }]
    langs.forEach((langCode) => {
      const key = `library.lang${langCode.charAt(0).toUpperCase() + langCode.slice(1)}`
      const translated = i18n.global.t(key)
      opts.push({ label: translated !== key ? translated : langCode.toUpperCase(), value: langCode })
    })

    return opts
  })

  function getStatusGroup(view: string, books: any[]): DisplayGroup[] | null {
    const t = i18n.global.t
    if (view === 'reading-now') {
      const filtered = books.filter(b => b.status === 'reading' || !b.status)
      filtered.sort((a, b) => new Date(b.progressUpdatedAt || b.updatedAt || 0).getTime() - new Date(a.progressUpdatedAt || a.updatedAt || 0).getTime())

      return [{ seriesName: t('library.menuReadingNow'), icon: 'mdi:book-open-page-variant-outline', books: filtered }]
    }

    if (view === 'favorites')
      return [{ seriesName: t('library.menuFavorites'), icon: 'mdi:star-outline', books: books.filter(b => b.isFavorite) }]
    if (view === 'to-read')
      return [{ seriesName: t('library.menuToRead'), icon: 'mdi:clock-outline', books: books.filter(b => b.status === 'to-read') }]
    if (view === 'have-read')
      return [{ seriesName: t('library.menuHaveRead'), icon: 'mdi:check-all', books: books.filter(b => b.status === 'have-read') }]
    if (view === 'books')
      return [{ seriesName: t('library.menuBooks'), icon: 'mdi:book-open-blank-variant', books: [...books].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()) }]

    return null
  }

  const displayGroups = computed<DisplayGroup[]>(() => {
    const t = i18n.global.t
    let filtered = store.books.filter((book) => {
      const matchLang = selectedLang.value === 'all' || book.language === selectedLang.value
      const matchSearch = book.title.toLowerCase().includes(searchQuery.value.toLowerCase())
        || (book.author && book.author.toLowerCase().includes(searchQuery.value.toLowerCase()))

      return matchLang && matchSearch
    })

    if (activeFolder.value) {
      if (currentView.value === 'authors')
        filtered = filtered.filter(b => (b.author?.trim() || t('library.unknownAuthor')) === activeFolder.value)

      else if (currentView.value === 'collections')
        filtered = filtered.filter(b => (b.collection?.trim() || t('library.noCollection')) === activeFolder.value)

      else if (currentView.value === 'series')
        filtered = filtered.filter(b => (b.series?.trim() || t('library.singleBooks')) === activeFolder.value)

      return [{ seriesName: activeFolder.value, isFolderContent: true, books: filtered }]
    }

    const statusGroup = getStatusGroup(currentView.value, filtered)
    if (statusGroup)
      return statusGroup

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
