<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'

interface Props { pageCount: number }
defineProps<Props>()
const page = defineModel<number>({ required: true })
const { t } = useI18n()
</script>

<template>
  <nav class="pagination" :aria-label="t('bookDeck.wordPages')">
    <KitBtn
      icon="mdi:chevron-left"
      size="sm"
      variant="text"
      :disabled="page === 0"
      :aria-label="t('bookDeck.previous')"
      @click="page--"
    />
    <span>{{ page + 1 }} / {{ pageCount }}</span>
    <KitBtn
      icon="mdi:chevron-right"
      size="sm"
      variant="text"
      :disabled="page + 1 >= pageCount"
      :aria-label="t('bookDeck.next')"
      @click="page++"
    />
  </nav>
</template>

<style scoped lang="scss">
.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  color: var(--fg-secondary-color);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}
</style>
