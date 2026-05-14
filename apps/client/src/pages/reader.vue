<script setup lang="ts">
import { useReaderStore } from '~/components/05.modules/reader/store/reader.store'
import MangaReaderView from '~/components/05.modules/reader/ui/manga-reader-view.vue'
import ReaderView from '~/components/05.modules/reader/ui/reader-view.vue'
import { AppRoutePaths } from '~/shared/constants/routes'

const store = useReaderStore()
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
  <div class="reader-page-wrapper">
    <template v-if="store.currentBook">
      <MangaReaderView v-if="store.currentBook.type === 'manga'" />
      <ReaderView v-else />
    </template>
  </div>
</template>

<style scoped>
.reader-page-wrapper {
  height: 100vh;
  width: 100%;
}
</style>
