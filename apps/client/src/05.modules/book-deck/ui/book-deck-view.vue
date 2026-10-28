<script setup lang="ts">
import { useRoute } from 'vue-router'
import { BookDeckWorkspace } from '~/04.features/book-deck'

const route = useRoute()
const bookId = computed(() => Number(route.params.bookId))
</script>

<template>
  <BookDeckWorkspace :key="bookId" :book-id="bookId" />
</template>
