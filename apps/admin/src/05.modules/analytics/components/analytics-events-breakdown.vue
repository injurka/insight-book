<script setup lang="ts">
import type { AdminEventsOverview } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitPanel from '~/02.kit/organisms/kit-panel.vue'
import { EVENT_CATEGORY_META } from '~/03.domain/user'

interface Props {
  overview: AdminEventsOverview
}

const props = defineProps<Props>()
const emit = defineEmits<{
  cleaned: []
  selectEvent: [eventName: string]
}>()

const { admin } = useRepos()
const cleaning = ref(false)
const cleanupMessage = ref('')

const maxCount = computed(() =>
  Math.max(1, ...props.overview.topEvents.map(e => e.totalCount)),
)

async function handleCleanup() {
  cleaning.value = true
  cleanupMessage.value = ''

  try {
    const res = await admin.cleanupAnalyticsEvents(props.overview.retentionDays)
    cleanupMessage.value = res.deletedCount > 0
      ? `Удалено ${res.deletedCount} старых записей`
      : 'Старых записей нет'
    emit('cleaned')
    setTimeout(() => {
      cleanupMessage.value = ''
    }, 3000)
  }
  finally {
    cleaning.value = false
  }
}
</script>

<template>
  <div class="eb-layout">
    <KitPanel title="Категории событий" icon="mdi:shape-outline">
      <template #meta>
        {{ overview.totalPeriodEvents.toLocaleString('ru-RU') }} соб. · {{ overview.activeEventUsersPeriod }} юз. за {{ overview.periodDays }} дн.
      </template>

      <div class="eb-categories">
        <div
          v-for="cat in overview.byCategory"
          :key="cat.category"
          class="eb-cat"
        >
          <div class="eb-cat__top">
            <span
              class="eb-cat__icon"
              :style="{ backgroundColor: EVENT_CATEGORY_META[cat.category].bgColor, color: EVENT_CATEGORY_META[cat.category].color }"
            >
              <Icon :icon="EVENT_CATEGORY_META[cat.category].icon" />
            </span>
            <span class="eb-cat__label">{{ cat.label }}</span>
          </div>
          <div class="eb-cat__nums">
            <span class="eb-cat__count">{{ cat.totalCount.toLocaleString('ru-RU') }}</span>
            <span class="eb-cat__users">{{ cat.uniqueUsers }} юз.</span>
          </div>
        </div>
      </div>

      <div class="eb-storage">
        <div class="eb-storage__info">
          <Icon icon="mdi:database-clock-outline" class="eb-storage__icon" />
          <span>
            В таблице <code>user_events</code>: <strong>{{ overview.totalStoredEvents.toLocaleString('ru-RU') }}</strong> записей · автоочистка старше {{ overview.retentionDays }} дн.
          </span>
        </div>
        <div class="eb-storage__actions">
          <span v-if="cleanupMessage" class="eb-storage__msg">{{ cleanupMessage }}</span>
          <KitBtn variant="outline" :disabled="cleaning" @click="handleCleanup">
            <Icon icon="mdi:broom" />
            <span>{{ cleaning ? 'Очистка...' : 'Очистить старые' }}</span>
          </KitBtn>
        </div>
      </div>
    </KitPanel>

    <KitPanel title="Топ продуктовых событий" icon="mdi:lightning-bolt-outline">
      <template #meta>
        Кликните по строке для фильтрации ленты
      </template>

      <ul v-if="overview.topEvents.length" class="eb-list">
        <li
          v-for="item in overview.topEvents"
          :key="item.event"
          class="eb-row"
          @click="emit('selectEvent', item.event)"
        >
          <div class="eb-row__top">
            <span class="eb-row__title">
              <Icon
                :icon="EVENT_CATEGORY_META[item.category].icon"
                :style="{ color: EVENT_CATEGORY_META[item.category].color }"
              />
              <span>{{ item.label }}</span>
              <code class="eb-row__code">{{ item.event }}</code>
            </span>
            <span class="eb-row__stats">
              <strong>{{ item.totalCount.toLocaleString('ru-RU') }}</strong> раз · {{ item.uniqueUsers }} юз. ({{ item.percentOfUsers }}%)
            </span>
          </div>
          <div class="eb-row__bar">
            <div
              class="eb-row__bar-fill"
              :style="{
                width: `${Math.max(3, Math.round((item.totalCount / maxCount) * 100))}%`,
                backgroundColor: EVENT_CATEGORY_META[item.category].color,
              }"
            />
          </div>
        </li>
      </ul>
      <p v-else class="eb-empty">
        Событий за выбранный период пока не зафиксировано — они начнут поступать батчами по мере действий пользователей
      </p>
    </KitPanel>
  </div>
</template>

<style scoped>
.eb-layout {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.eb-categories {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
  gap: 12px;
}

.eb-cat {
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.eb-cat__top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.eb-cat__icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.eb-cat__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
}

.eb-cat__nums {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.eb-cat__count {
  font-size: 22px;
  font-weight: 700;
  color: var(--fg-primary-color, #4a443c);
}

.eb-cat__users {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
}

.eb-storage {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border-secondary-color, #d9d1c7);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.eb-storage__info {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--fg-secondary-color, #8e867b);
}

.eb-storage__info strong {
  color: var(--fg-primary-color, #4a443c);
}

.eb-storage__info code {
  font-size: 11.5px;
  background: var(--bg-primary-color, #f3efe9);
  padding: 1px 5px;
  border-radius: 4px;
}

.eb-storage__icon {
  font-size: 17px;
  color: var(--fg-accent-color, #4b8266);
}

.eb-storage__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.eb-storage__msg {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-accent-color, #4b8266);
}

.eb-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.eb-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 6px 8px;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s;
}

.eb-row:hover {
  background: var(--bg-overlay-primary-color, rgba(142, 134, 123, 0.12));
}

.eb-row__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.eb-row__title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
}

.eb-row__code {
  font-size: 11px;
  font-weight: 400;
  color: var(--fg-secondary-color, #8e867b);
  background: var(--bg-primary-color, #f3efe9);
  padding: 1px 6px;
  border-radius: 4px;
}

.eb-row__stats {
  font-size: 12.5px;
  color: var(--fg-secondary-color, #8e867b);
}

.eb-row__stats strong {
  color: var(--fg-primary-color, #4a443c);
}

.eb-row__bar {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-primary-color, #f3efe9);
  overflow: hidden;
}

.eb-row__bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.eb-empty {
  margin: 0;
  padding: 16px 0;
  font-size: 13px;
  color: var(--fg-secondary-color, #8e867b);
}
</style>
