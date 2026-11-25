<script setup lang="ts">
import type { ProductEventCatalogItem, ProductEventCategory, ProductEventFeedItem } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitPagination from '~/02.kit/molecules/kit-pagination.vue'
import KitSelect from '~/02.kit/molecules/kit-select.vue'
import KitPanel from '~/02.kit/organisms/kit-panel.vue'
import { EVENT_CATEGORY_META, formatEventMetaTags, formatRelativeTime } from '~/03.domain/user'

interface Props {
  catalog: ProductEventCatalogItem[]
  selectedEventFilter?: string
}

const props = withDefaults(defineProps<Props>(), {
  selectedEventFilter: 'all',
})

const { admin } = useRepos()

type CategoryFilter = ProductEventCategory | 'all'

const items = ref<ProductEventFeedItem[]>([])
const total = ref(0)
const page = ref(1)
const limit = 25
const category = ref<CategoryFilter>('all')
const eventFilter = ref<string>(props.selectedEventFilter || 'all')
const loading = ref(true)

const categoryPills: Array<{ value: CategoryFilter, label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'reader', label: 'Читалка' },
  { value: 'ai', label: 'AI' },
  { value: 'learning', label: 'Словарь и SRS' },
  { value: 'library', label: 'Библиотека' },
  { value: 'auth', label: 'Аккаунт' },
]

const eventOptions = computed(() => [
  { value: 'all', label: 'Все события' },
  ...props.catalog.map(c => ({ value: c.name, label: c.label })),
])

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

async function load() {
  loading.value = true

  try {
    const res = await admin.listAnalyticsEvents({
      page: page.value,
      limit,
      category: category.value,
      event: eventFilter.value !== 'all' ? eventFilter.value : undefined,
    })
    items.value = res.data
    total.value = res.total
  }
  finally {
    loading.value = false
  }
}

function selectCategory(next: CategoryFilter) {
  category.value = next
  eventFilter.value = 'all'
  page.value = 1
  load()
}

function onEventChange(val: string) {
  eventFilter.value = val
  if (val !== 'all')
    category.value = 'all'
  page.value = 1
  load()
}

function onPageChange(p: number) {
  page.value = p
  load()
}

watch(() => props.selectedEventFilter, (val) => {
  if (val && val !== eventFilter.value) {
    eventFilter.value = val
    category.value = 'all'
    page.value = 1
    load()
  }
})

onMounted(() => load())
</script>

<template>
  <KitPanel title="Живая лента событий" icon="mdi:timeline-text-outline">
    <template #meta>
      Всего по фильтру: {{ total.toLocaleString('ru-RU') }}
    </template>

    <div class="es-filters">
      <div class="es-pills">
        <button
          v-for="pill in categoryPills"
          :key="pill.value"
          type="button"
          class="es-pill"
          :class="{ 'es-pill--active': category === pill.value && eventFilter === 'all' }"
          @click="selectCategory(pill.value)"
        >
          {{ pill.label }}
        </button>
      </div>

      <div class="es-event-select">
        <KitSelect
          :model-value="eventFilter"
          :options="eventOptions"
          @update:model-value="onEventChange"
        />
      </div>
    </div>

    <div v-if="loading" class="es-skeletons">
      <KitSkeleton v-for="i in 6" :key="i" height="42px" />
    </div>

    <ul v-else-if="items.length" class="es-feed">
      <li v-for="item in items" :key="item.id" class="es-item">
        <span
          class="es-item__icon"
          :style="{
            backgroundColor: EVENT_CATEGORY_META[item.category].bgColor,
            color: EVENT_CATEGORY_META[item.category].color,
          }"
        >
          <Icon :icon="EVENT_CATEGORY_META[item.category].icon" />
        </span>

        <div class="es-item__body">
          <div class="es-item__main">
            <RouterLink :to="`/users/${item.userId}?tab=events`" class="es-item__user">
              {{ item.username }}
            </RouterLink>
            <span class="es-item__label">{{ item.label }}</span>
            <code class="es-item__code">{{ item.event }}</code>
          </div>

          <div v-if="formatEventMetaTags(item.meta).length" class="es-item__tags">
            <span
              v-for="(tag, idx) in formatEventMetaTags(item.meta)"
              :key="idx"
              class="es-item__tag"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <span class="es-item__time" :title="item.createdAt">
          {{ formatRelativeTime(item.createdAt) }}
        </span>
      </li>
    </ul>

    <p v-else class="es-empty">
      События по выбранному фильтру не найдены
    </p>

    <KitPagination
      v-if="totalPages > 1"
      :page="page"
      :total-pages="totalPages"
      @update:page="onPageChange"
    />
  </KitPanel>
</template>

<style scoped>
.es-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.es-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.es-pill {
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  background: var(--bg-primary-color, #f3efe9);
  color: var(--fg-secondary-color, #8e867b);
  font-size: 12.5px;
  font-weight: 500;
  padding: 5px 11px;
  border-radius: 999px;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.es-pill:hover {
  color: var(--fg-primary-color, #4a443c);
}

.es-pill--active {
  background: var(--fg-accent-color, #4b8266);
  border-color: var(--fg-accent-color, #4b8266);
  color: #f3efe9;
  font-weight: 600;
}

.es-event-select {
  width: 250px;
}

.es-skeletons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.es-feed {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.es-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 6px;
  border-bottom: 1px solid var(--border-secondary-color, #d9d1c7);
}

.es-item:last-child {
  border-bottom: none;
}

.es-item__icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  flex-shrink: 0;
}

.es-item__body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.es-item__main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.es-item__user {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--fg-accent-color, #4b8266);
  text-decoration: none;
}

.es-item__user:hover {
  text-decoration: underline;
}

.es-item__label {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--fg-primary-color, #4a443c);
}

.es-item__code {
  font-size: 11px;
  color: var(--fg-secondary-color, #8e867b);
  background: var(--bg-primary-color, #f3efe9);
  padding: 1px 6px;
  border-radius: 4px;
}

.es-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.es-item__tag {
  font-size: 11.5px;
  color: var(--fg-secondary-color, #8e867b);
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  padding: 1px 7px;
  border-radius: 999px;
}

.es-item__time {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
  white-space: nowrap;
  flex-shrink: 0;
}

.es-empty {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--fg-secondary-color, #8e867b);
}
</style>
