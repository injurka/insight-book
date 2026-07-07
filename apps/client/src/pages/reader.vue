<script setup lang="ts">
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import { useHighlightsStore } from '~/components/05.modules/reader/store/highlights.store'
import { useReaderStore } from '~/components/05.modules/reader/store/reader.store'
import MangaReaderView from '~/components/05.modules/reader/ui/manga-reader-view.vue'
import ReaderView from '~/components/05.modules/reader/ui/reader-view.vue'
import { AppRoutePaths } from '~/shared/constants/routes'

const store = useReaderStore()
const highlightsStore = useHighlightsStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

useHead({
  title: computed(() => store.currentBook ? `${store.currentBook.title} — ${t('routes.reader')}` : t('routes.reader')),
})

onMounted(async () => {
  const bookId = Number(route.query.bookId)
  const queryPage = route.query.page
  const parsedPage = queryPage ? Number(queryPage) : undefined
  const page = (parsedPage && !Number.isNaN(parsedPage)) ? parsedPage : undefined

  if (bookId) {
    if (!store.currentBook || store.currentBook.id !== bookId) {
      try {
        await store.openBookById(bookId, page)
      }
      catch {
        router.replace(AppRoutePaths.Home)
      }
    }
    else {
      highlightsStore.clear()
      highlightsStore.fetchHighlights(bookId).catch(console.error)

      const targetPage = page || store.currentBook.currentPage || 1
      if (!store.currentPage || store.currentPage.pageNum !== targetPage) {
        store.loadPage(bookId, targetPage)
      }
    }
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
  width: 100%;
  height: 100%;
}
</style>
