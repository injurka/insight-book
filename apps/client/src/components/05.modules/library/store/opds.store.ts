import type { OpdsCatalog, OpdsFeed } from '~/shared/types/models'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '~/shared/services/api.service'
import { useToastStore } from '~/shared/store/toast.store'
import { useLibraryStore } from './library.store'

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

  async function browse(url: string) {
    isBrowsing.value = true
    try {
      currentFeed.value = await api.opds.browse(url)
    }
    finally {
      isBrowsing.value = false
    }
  }

  async function downloadBook(downloadUrl: string, title: string, type?: string) {
    isDownloading.value = true
    try {
      const res = await api.opds.download({ downloadUrl, title, type })
      const libraryStore = useLibraryStore()
      if (res.book) {
        libraryStore.books.unshift(res.book)
        useToastStore().success('Книга скачана и добавлена в библиотеку!')
      }
    }
    catch (e) {
      useToastStore().error(e instanceof Error ? e.message : 'Ошибка скачивания')
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
