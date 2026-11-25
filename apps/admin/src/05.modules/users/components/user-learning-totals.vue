<script setup lang="ts">
import type { AdminUserDetailedAnalytics } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import KitPanel from '~/02.kit/organisms/kit-panel.vue'

interface Props {
  totals: AdminUserDetailedAnalytics['totals']
}

const props = defineProps<Props>()

const items = computed(() => [
  { key: 'books', icon: 'mdi:bookshelf', label: 'Книг', value: props.totals.booksCount, hint: '' },
  { key: 'pages', icon: 'mdi:book-open-page-variant-outline', label: 'Страниц прочитано', value: props.totals.pagesRead, hint: '' },
  { key: 'words', icon: 'mdi:book-alphabet', label: 'Слов в словаре', value: props.totals.totalWords, hint: `выучено ${props.totals.learnedWords}` },
  { key: 'reviews', icon: 'mdi:cards-outline', label: 'Повторений', value: props.totals.wordsReviewed, hint: '' },
  { key: 'highlights', icon: 'mdi:marker', label: 'Заметок', value: props.totals.highlightsCount, hint: '' },
  { key: 'plugins', icon: 'mdi:puzzle-outline', label: 'Плагинов', value: props.totals.pluginsCount, hint: `push ${props.totals.pushEnabled ? 'вкл' : 'выкл'}` },
])
</script>

<template>
  <KitPanel title="Контент и обучение" icon="mdi:school-outline">
    <div class="totals">
      <div v-for="item in items" :key="item.key" class="totals__item">
        <Icon :icon="item.icon" class="totals__icon" />
        <div class="totals__texts">
          <div class="totals__value">
            {{ item.value.toLocaleString('ru-RU') }}
          </div>
          <div class="totals__label">
            {{ item.label }}<template v-if="item.hint">
              · {{ item.hint }}
            </template>
          </div>
        </div>
      </div>
    </div>
  </KitPanel>
</template>

<style scoped>
.totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 10px;
}

.totals__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
}

.totals__icon {
  font-size: 22px;
  color: var(--fg-accent-color, #4b8266);
  flex-shrink: 0;
}

.totals__texts {
  min-width: 0;
}

.totals__value {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--fg-primary-color, #4a443c);
}

.totals__label {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
