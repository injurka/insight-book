<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ReaderView from '~/components/05.modules/reader/ui/reader-view.vue'
import { useBooksStore } from '~/shared/store/books.store'

const store = useBooksStore()
const router = useRouter()
const route = useRoute()

onMounted(async () => {
  const bookId = Number(route.query.bookId)
  const page = Number(route.query.page)

  // Если в URL есть ID книги
  if (bookId) {
    // Если книга еще не загружена или ID не совпадает с текущей
    if (!store.currentBook || store.currentBook.id !== bookId) {
      try {
        await store.openBookById(bookId, page || undefined)
      }
      catch {
        // Если книги не существует, выкидываем на главную
        router.replace('/')
      }
    }
    else if (page && store.currentBook.currentPage !== page) {
      // Если книга открыта, но страница в URL другая
      store.loadPage(bookId, page)
    }
  }
  else {
    // Если нет ID в URL (просто перешли на /reader), выкидываем обратно
    router.replace('/')
  }
})
</script>

<template>
  <ReaderView />
</template>
