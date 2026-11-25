<script setup lang="ts">
import type { AdminUserEventsResponse, ProductEventCategory, ProductEventFeedItem } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitPagination from '~/02.kit/molecules/kit-pagination.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'
import KitPanel from '~/02.kit/organisms/kit-panel.vue'
import { EVENT_CATEGORY_META, formatEventMetaTags, formatRelativeTime, parseServerDate } from '~/03.domain/user'

interface Props {
  userId: number
}

const props = defineProps<Props>()
const { admin } = useRepos()

type CategoryFilter = ProductEventCategory | 'all'

const items = ref<ProductEventFeedItem[]>([])
const topEvents = ref<AdminUserEventsResponse['topEvents']>([])
const total = ref(0)
const page = ref(1)
const limit = 25
const category = ref<CategoryFilter>('all')
const activeEvent = ref<string>('all')
const loading = ref(true)
const error = ref('')

const categoryPills: Array<{ value: CategoryFilter, label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'reader', label: 'Читалка' },
  { value: 'ai', label: 'AI' },
  { value: 'learning', label: 'Словарь и SRS' },
  { value: 'library', label: 'Библиотека' },
  { value: 'auth', label: 'Аккаунт' },
]

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))

function formatExactTime(iso: string): string {
  return parseServerDate(iso)?.toLocaleString('ru-RU') ?? iso
}

async function load() {
  loading.value = true
  error.value = ''

  try {
    const res = await admin.getUserEvents(props.userId, {
      page: page.value,
      limit,
      category: category.value,
      event: activeEvent.value !== 'all' ? activeEvent.value : undefined,
    })
    items.value = res.data
    topEvents.value = res.topEvents
    total.value = res.total
  }
  catch (e: unknown) {
    error.value = (e as Error).message || 'Не удалось загрузить события пользователя'
  }
  finally {
    loading.value = false
  }
}

function selectCategory(next: CategoryFilter) {
  category.value = next
  activeEvent.value = 'all'
  page.value = 1
  load()
}

function toggleTopEvent(eventName: string) {
  activeEvent.value = activeEvent.value === eventName ? 'all' : eventName
  category.value = 'all'
  page.value = 1
  load()
}

function onPageChange(p: number) {
  page.value = p
  load()
}

watch(() => props.userId, () => {
  page.value = 1
  category.value = 'all'
  activeEvent.value = 'all'
  load()
})

onMounted(() => load())
</script>

<template>
  <div class="uet-wrap">
    <KitError v-if="error" :message="error" />

    <KitPanel
      v-if="topEvents.length"
      title="Частые действия пользователя"
      icon="mdi:star-shooting-outline"
    >
      <template #meta>
        Кликните для фильтрации хронологии
      </template>

      <div class="uet-top-chips">
        <button
          v-for="ev in topEvents"
          :key="ev.event"
          type="button"
          class="uet-top-chip"
          :class="{ 'uet-top-chip--active': activeEvent === ev.event }"
          @click="toggleTopEvent(ev.event)"
        >
          <Icon
            :icon="EVENT_CATEGORY_META[ev.category].icon"
            :style="{ color: activeEvent === ev.event ? '#f3efe9' : EVENT_CATEGORY_META[ev.category].color }"
          />
          <span>{{ ev.label }}</span>
          <span class="uet-top-chip__count">{{ ev.count }}</span>
        </button>
      </div>
    </KitPanel>

    <KitPanel title="Хронология событий" icon="mdi:timeline-text-outline">
      <template #meta>
        {{ total.toLocaleString('ru-RU') }} записей (за последние 90 дн.)
      </template>

      <div class="uet-pills">
        <button
          v-for="pill in categoryPills"
          :key="pill.value"
          type="button"
          class="uet-pill"
          :class="{ 'uet-pill--active': category === pill.value && activeEvent === 'all' }"
          @click="selectCategory(pill.value)"
        >
          {{ pill.label }}
        </button>
      </div>

      <div v-if="loading" class="uet-skeletons">
        <KitSkeleton v-for="i in 6" :key="i" height="44px" />
      </div>

      <ol v-else-if="items.length" class="uet-timeline">
        <li v-for="item in items" :key="item.id" class="uet-row">
          <span
            class="uet-row__dot"
            :style="{
              backgroundColor: EVENT_CATEGORY_META[item.category].bgColor,
              color: EVENT_CATEGORY_META[item.category].color,
            }"
          >
            <Icon :icon="EVENT_CATEGORY_META[item.category].icon" />
          </span>

          <div class="uet-row__content">
            <div class="uet-row__head">
              <span class="uet-row__label">{{ item.label }}</span>
              <code class="uet-row__code">{{ item.event }}</code>
            </div>

            <div v-if="formatEventMetaTags(item.meta).length" class="uet-row__tags">
              <span
                v-for="(tag, idx) in formatEventMetaTags(item.meta)"
                :key="idx"
                class="uet-row__tag"
              >
                {{ tag }}
              </span>
            </div>
          </div>

          <div class="uet-row__time">
            <div class="uet-row__rel">
              {{ formatRelativeTime(item.createdAt) }}
            </div>
            <div class="uet-row__exact">
              {{ formatExactTime(item.createdAt) }}
            </div>
          </div>
        </li>
      </ol>

      <p v-else class="uet-empty">
        Для этого пользователя пока нет записанных событий по выбранному фильтру
      </p>

      <KitPagination
        v-if="totalPages > 1"
        :page="page"
        :total-pages="totalPages"
        @update:page="onPageChange"
      />
    </KitPanel>
  </div>
</template>

<style scoped>
.uet-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.uet-top-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.uet-top-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  background: var(--bg-primary-color, #f3efe9);
  color: var(--fg-primary-color, #4a443c);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.uet-top-chip--active {
  background: var(--fg-accent-color, #4b8266);
  border-color: var(--fg-accent-color, #4b8266);
  color: #f3efe9;
  font-weight: 600;
}

.uet-top-chip__count {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--bg-secondary-color, #e8e2d9);
  color: var(--fg-secondary-color, #8e867b);
}

.uet-top-chip--active .uet-top-chip__count {
  background: rgba(255, 255, 255, 0.2);
  color: #f3efe9;
}

.uet-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.uet-pill {
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  background: var(--bg-primary-color, #f3efe9);
  color: var(--fg-secondary-color, #8e867b);
  font-size: 12.5px;
  font-weight: 500;
  padding: 5px 11px;
  border-radius: 999px;
  cursor: pointer;
}

.uet-pill:hover {
  color: var(--fg-primary-color, #4a443c);
}

.uet-pill--active {
  background: var(--fg-accent-color, #4b8266);
  border-color: var(--fg-accent-color, #4b8266);
  color: #f3efe9;
  font-weight: 600;
}

.uet-skeletons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.uet-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.uet-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 6px;
  border-bottom: 1px solid var(--border-secondary-color, #d9d1c7);
}

.uet-row:last-child {
  border-bottom: none;
}

.uet-row__dot {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  flex-shrink: 0;
}

.uet-row__content {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.uet-row__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.uet-row__label {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
}

.uet-row__code {
  font-size: 11px;
  color: var(--fg-secondary-color, #8e867b);
  background: var(--bg-primary-color, #f3efe9);
  padding: 1px 6px;
  border-radius: 4px;
}

.uet-row__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.uet-row__tag {
  font-size: 11.5px;
  color: var(--fg-secondary-color, #8e867b);
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  padding: 1px 7px;
  border-radius: 999px;
}

.uet-row__time {
  text-align: right;
  flex-shrink: 0;
}

.uet-row__rel {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--fg-primary-color, #4a443c);
}

.uet-row__exact {
  font-size: 11px;
  color: var(--fg-secondary-color, #8e867b);
}

.uet-empty {
  margin: 0;
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--fg-secondary-color, #8e867b);
}
</style>
