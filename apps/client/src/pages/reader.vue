<script setup lang="ts">
import AddEditWordDialog from '~/components/05.modules/dictionary/ui/add-edit-word-dialog.vue'
import MangaReaderView from '~/components/05.modules/reader/ui/manga-reader-view.vue'
import ReaderView from '~/components/05.modules/reader/ui/reader-view.vue'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useBooksStore } from '~/shared/store/books.store'

const store = useBooksStore()
const router = useRouter()
const route = useRoute()

onMounted(async () => {
  const bookId = Number(route.query.bookId)
  const page = Number(route.query.page)

  if (bookId) {
    if (!store.currentBook || store.currentBook.id !== bookId) {
      try {
        await store.openBookById(bookId, page || undefined)
      }
      catch {
        router.replace(AppRoutePaths.Home)
      }
    }
    else if (page && store.currentBook.currentPage !== page) {
      store.loadPage(bookId, page)
    }
  }
  else {
    router.replace(AppRoutePaths.Home)
  }
})
</script>

<template>
  <template v-if="store.currentBook">
    <MangaReaderView v-if="store.currentBook.type === 'manga'" />
    <ReaderView v-else />
  </template>
  <AddEditWordDialog />
</template>
