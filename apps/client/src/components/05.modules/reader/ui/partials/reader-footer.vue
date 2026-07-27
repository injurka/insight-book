<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitPrompt } from '~/components/01.kit'
import { BookEntity } from '~/components/03.domain/entities/book.entity'
import { useReaderStore } from '../../store/reader.store'

const emit = defineEmits(['prev', 'next', 'goTo'])
const readerStore = useReaderStore()
const { t } = useI18n()

const isPromptOpen = ref(false)

const bookEntity = computed(() => readerStore.currentBook ? new BookEntity(readerStore.currentBook) : null)

function openPrompt() {
  if (!readerStore.currentBook)
    return

  isPromptOpen.value = true
}

function handlePageSubmit(value: string) {
  const total = readerStore.currentBook?.totalPages || 1
  const current = readerStore.currentBook?.currentPage || 1
  const page = Number.parseInt(value, 10)

  if (!Number.isNaN(page) && page >= 1 && page <= total && page !== current) {
    emit('goTo', page)
  }
}
</script>

<template>
  <footer class="reader-footer">
    <KitBtn
      icon="mdi:chevron-left"
      variant="text"
      :disabled="!bookEntity || !bookEntity.hasPrevPage()"
      @click="emit('prev')"
    >
      {{ t('reader.back') }}
    </KitBtn>

    <span
      v-if="readerStore.currentBook"
      class="page-info"
      :title="t('reader.goToPage')"
      @click="openPrompt"
    >
      {{ readerStore.currentBook.currentPage }} / {{ readerStore.currentBook.totalPages }}
    </span>

    <KitBtn
      append-icon="mdi:chevron-right"
      variant="text"
      :disabled="!bookEntity || !bookEntity.hasNextPage()"
      @click="emit('next')"
    >
      {{ t('reader.forward') }}
    </KitBtn>

    <KitPrompt
      v-model:visible="isPromptOpen"
      :title="t('reader.goToPage')"
      :description="t('reader.enterPageNumber', { total: readerStore.currentBook?.totalPages || 1 })"
      input-type="number"
      :placeholder="t('reader.pageNumber')"
      :default-value="readerStore.currentBook?.currentPage || 1"
      :confirm-text="t('reader.go')"
      @submit="handlePageSubmit"
    />
  </footer>
</template>

<style lang="scss" scoped>
.reader-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;

  .page-info {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
    user-select: none;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 4px;
    transition: color 0.2s;

    &:hover {
      color: var(--fg-accent-color);
    }
  }
}
</style>
