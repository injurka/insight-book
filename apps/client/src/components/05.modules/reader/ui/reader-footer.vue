<script setup lang="ts">
import { KitBtn, KitPrompt } from '~/components/01.kit'
import { useReaderStore } from '../store/reader.store'

const emit = defineEmits(['prev', 'next', 'goTo'])
const readerStore = useReaderStore()

const isPromptOpen = ref(false)

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
  <footer class="reader-footer" @click.stop>
    <KitBtn
      icon="mdi:chevron-left"
      variant="text"
      :disabled="(readerStore.currentBook?.currentPage || 1) <= 1"
      @click="emit('prev')"
    >
      Назад
    </KitBtn>

    <span
      v-if="readerStore.currentBook"
      class="page-info"
      title="Перейти на страницу"
      @click="openPrompt"
    >
      {{ readerStore.currentBook.currentPage }} / {{ readerStore.currentBook.totalPages }}
    </span>

    <KitBtn
      append-icon="mdi:chevron-right"
      variant="text"
      :disabled="(readerStore.currentBook?.currentPage || 1) >= (readerStore.currentBook?.totalPages || 1)"
      @click="emit('next')"
    >
      Вперед
    </KitBtn>

    <KitPrompt
      v-model:visible="isPromptOpen"
      title="Переход на страницу"
      :description="`Введите номер страницы (от 1 до ${readerStore.currentBook?.totalPages || 1}):`"
      input-type="number"
      placeholder="Номер страницы"
      :default-value="readerStore.currentBook?.currentPage || 1"
      confirm-text="Перейти"
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
