<script setup lang="ts">
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { useHighlightsStore } from '~/05.modules/reader/store/highlights.store'
import { useReaderStore } from '~/05.modules/reader/store/reader.store'
import BookReaderView from '~/05.modules/reader/ui/book-reader-view.vue'
import MangaReaderView from '~/05.modules/reader/ui/manga-reader-view.vue'

const store = useReaderStore()
const highlightsStore = useHighlightsStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

useHead({
  title: computed(() => store.currentBook ? `${store.currentBook.title} — ${t('routes.reader')}` : t('routes.reader')),
})

async function initBookSession(bookId: number, page?: number) {
  if (!store.currentBook || store.currentBook.id !== bookId) {
    try {
      await store.openBookById(bookId, page)
    }
    catch {
      router.replace(AppRoutePaths.Home)
    }

    return
  }

  highlightsStore.clear()
  highlightsStore.fetchHighlights(bookId).catch(console.error)

  const targetPage = page || store.currentBook.currentPage || 1
  if (!store.currentPage || store.currentPage.pageNum !== targetPage)
    store.loadPage(bookId, targetPage)
}

onMounted(async () => {
  const bookId = Number(route.query.bookId)
  const queryPage = route.query.page
  const parsedPage = queryPage ? Number(queryPage) : undefined
  const page = (parsedPage && !Number.isNaN(parsedPage)) ? parsedPage : undefined

  if (bookId)
    await initBookSession(bookId, page)
})
</script>

<template>
  <div class="reader-page-wrapper">
    <template v-if="store.currentBook">
      <MangaReaderView v-if="store.currentBook.type === 'manga'" />
      <BookReaderView v-else />
    </template>
  </div>
</template>

<style scoped>
.reader-page-wrapper {
  width: 100%;
  height: 100%;
}
</style>
