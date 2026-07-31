<script setup lang="ts">
import type { Book } from '~/01.shared/types/models'
import { useElementSize, useInfiniteScroll, useMediaQuery, useVirtualList } from '@vueuse/core'
import BookCard from '../book-card.vue'

interface Props {
  books: Book[]
  hasMore?: boolean
  isLoading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'openBook', book: Book): void
  (e: 'editBook', book: Book): void
  (e: 'loadMore'): void
}>()

// Совпадает с media-down(sm) ($breakpoints.sm = 600px)
const isMobile = useMediaQuery('(max-width: 599px)')

const MIN_CARD_WIDTH = 220
// Приблизительная высота инфо-блока карточки под обложкой (padding, заголовок, автор, прогресс)
const CARD_INFO_HEIGHT = 160

const gap = computed(() => isMobile.value ? 12 : 24)

const containerRef = shallowRef<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(containerRef)

const columns = computed(() => {
  if (isMobile.value)
    return 1
  const w = containerWidth.value
  if (!w)
    return 4
  return Math.max(1, Math.floor((w + gap.value) / (MIN_CARD_WIDTH + gap.value)))
})

// Высота строки: обложка (aspect-ratio 2/3) + инфо-блок + отступ между строками
const rowHeight = computed(() => {
  if (isMobile.value)
    return 144 + gap.value // обложка 120px + padding карточки
  const w = containerWidth.value
  if (!w)
    return 480
  const colWidth = (w - gap.value * (columns.value - 1)) / columns.value
  return Math.ceil(colWidth * 1.5) + CARD_INFO_HEIGHT + gap.value
})

const rows = computed(() => {
  const cols = columns.value
  const result: Book[][] = []
  for (let i = 0; i < props.books.length; i += cols)
    result.push(props.books.slice(i, i + cols))
  return result
})

const { list, containerProps, wrapperProps } = useVirtualList(rows, {
  itemHeight: () => rowHeight.value,
  overscan: 2,
})

watch(() => containerProps.ref.value, (el) => {
  if (el)
    containerRef.value = el
}, { immediate: true })

useInfiniteScroll(containerRef, () => {
  if (props.hasMore && !props.isLoading)
    emit('loadMore')
}, { distance: 800 })
</script>

<template>
  <div class="books-virtual-container" v-bind="containerProps">
    <div v-bind="wrapperProps">
      <div
        v-for="row in list"
        :key="row.index"
        class="books-grid-row"
        :style="{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: `${gap}px`,
          height: `${rowHeight - gap}px`,
          marginBottom: `${gap}px`,
        }"
      >
        <BookCard
          v-for="book in row.data"
          :key="book.id"
          :book="book"
          @click="emit('openBook', book)"
          @edit="emit('editBook', book)"
        />
      </div>
    </div>

    <div v-if="isLoading && books.length" class="loading-more">
      <span class="loading-spinner" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.books-virtual-container {
  flex-grow: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.books-grid-row {
  display: grid;
  align-items: stretch;
}

.loading-more {
  display: flex;
  justify-content: center;
  padding: 24px 0;

  .loading-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--border-secondary-color);
    border-top-color: var(--fg-accent-color);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
