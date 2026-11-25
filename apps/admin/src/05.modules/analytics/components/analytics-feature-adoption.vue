<script setup lang="ts">
import type { FeatureAdoptionItem } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'

interface Props {
  items: FeatureAdoptionItem[]
  totalUsers: number
}

defineProps<Props>()

const featureIcons: Record<FeatureAdoptionItem['key'], string> = {
  reader: 'mdi:book-open-variant',
  ai: 'mdi:sparkles',
  dictionary: 'mdi:book-alphabet',
  srs: 'mdi:cards-outline',
  highlights: 'mdi:marker',
  quizzes: 'mdi:help-circle-outline',
  plugins: 'mdi:puzzle-outline',
  push: 'mdi:bell-outline',
}
</script>

<template>
  <section class="adoption-card">
    <div class="adoption-card__header">
      <Icon icon="mdi:compass-outline" class="adoption-card__icon" />
      <div>
        <h2 class="adoption-card__title">
          Использование функций
        </h2>
        <p class="adoption-card__subtitle">
          Сколько пользователей хотя бы раз попробовали каждую возможность
        </p>
      </div>
    </div>

    <div class="adoption-list">
      <div
        v-for="item in items"
        :key="item.key"
        class="adoption-row"
      >
        <div class="adoption-row__top">
          <span class="adoption-row__name">
            <Icon :icon="featureIcons[item.key]" class="adoption-row__icon" />
            <span>{{ item.label }}</span>
          </span>
          <span class="adoption-row__stats">
            <strong>{{ item.usersCount }}</strong> / {{ totalUsers }} ({{ item.percentOfTotal }}%)
          </span>
        </div>
        <div class="adoption-row__track">
          <div
            class="adoption-row__fill"
            :style="{ width: `${Math.max(item.percentOfTotal, item.usersCount > 0 ? 3 : 0)}%` }"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.adoption-card {
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 10px;
  padding: 20px 22px;
}

.adoption-card__header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 16px;
}

.adoption-card__icon {
  font-size: 22px;
  color: var(--fg-accent-color, #4b8266);
  margin-top: 1px;
  flex-shrink: 0;
}

.adoption-card__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  margin: 0;
}

.adoption-card__subtitle {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
  margin: 3px 0 0;
}

.adoption-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.adoption-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.adoption-row__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}

.adoption-row__name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--fg-primary-color, #4a443c);
}

.adoption-row__icon {
  font-size: 16px;
  color: var(--fg-secondary-color, #8e867b);
}

.adoption-row__stats {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
}

.adoption-row__stats strong {
  color: var(--fg-primary-color, #4a443c);
}

.adoption-row__track {
  height: 7px;
  border-radius: 999px;
  background: var(--bg-primary-color, #f3efe9);
  overflow: hidden;
}

.adoption-row__fill {
  height: 100%;
  border-radius: 999px;
  background: var(--fg-highlight-color, #c2a14d);
  transition: width 0.3s ease;
}
</style>
