<script setup lang="ts">
import type { TopEngagedUser } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import KitBadge from '~/02.kit/atoms/kit-badge.vue'
import { formatCost, formatDuration, formatRelativeTime, getSegmentMeta } from '~/03.domain/user'

interface Props {
  users: TopEngagedUser[]
  periodDays: number
}

defineProps<Props>()
</script>

<template>
  <section class="top-users-card">
    <div class="top-users-card__header">
      <div class="top-users-card__title-wrap">
        <Icon icon="mdi:trophy-outline" class="top-users-card__icon" />
        <div>
          <h2 class="top-users-card__title">
            Самые вовлечённые пользователи ({{ periodDays }} дн.)
          </h2>
          <p class="top-users-card__subtitle">
            Рейтинг по активному времени, чтению и работе со словарём
          </p>
        </div>
      </div>
      <RouterLink to="/users" class="top-users-card__all-link">
        Все пользователи
        <Icon icon="mdi:arrow-right" />
      </RouterLink>
    </div>

    <div v-if="users.length" class="top-users-table-wrap">
      <table class="top-users-table">
        <thead>
          <tr>
            <th>Пользователь</th>
            <th>Статус</th>
            <th>Время на сайте</th>
            <th>В читалке</th>
            <th>Чтение / Словарь</th>
            <th>Последний визит</th>
            <th class="text-right">
              LLM
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>
              <RouterLink :to="`/users/${u.id}`" class="top-users-table__user">
                <span class="top-users-table__avatar">
                  {{ u.username.slice(0, 1).toUpperCase() }}
                </span>
                <div>
                  <div class="top-users-table__name">
                    {{ u.username }}
                  </div>
                  <div class="top-users-table__sub">
                    {{ u.subscriptionTier }} · {{ u.booksCount }} кн.
                  </div>
                </div>
              </RouterLink>
            </td>
            <td>
              <KitBadge :variant="getSegmentMeta(u.segment).badgeVariant">
                {{ getSegmentMeta(u.segment).shortLabel }}
              </KitBadge>
            </td>
            <td class="top-users-table__strong">
              {{ formatDuration(u.activeSeconds) }}
            </td>
            <td class="top-users-table__muted">
              {{ formatDuration(u.readingSeconds) }}
            </td>
            <td class="top-users-table__muted">
              {{ u.pagesRead }} стр. · +{{ u.wordsAdded }} сл. · {{ u.wordsReviewed }} повт.
            </td>
            <td class="top-users-table__muted">
              {{ formatRelativeTime(u.lastActiveAt) }}
            </td>
            <td class="top-users-table__muted text-right">
              {{ formatCost(u.llmCost) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="top-users-empty">
      Пока нет данных об активности за выбранный период
    </div>
  </section>
</template>

<style scoped>
.top-users-card {
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 10px;
  padding: 20px 22px;
}

.top-users-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.top-users-card__title-wrap {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.top-users-card__icon {
  font-size: 22px;
  color: var(--fg-highlight-color, #c2a14d);
  margin-top: 1px;
  flex-shrink: 0;
}

.top-users-card__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  margin: 0;
}

.top-users-card__subtitle {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
  margin: 3px 0 0;
}

.top-users-card__all-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-accent-color, #4b8266);
  text-decoration: none;
}

.top-users-card__all-link:hover {
  text-decoration: underline;
}

.top-users-table-wrap {
  overflow-x: auto;
}

.top-users-table {
  width: 100%;
  border-collapse: collapse;
}

.top-users-table th {
  text-align: left;
  padding: 9px 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--fg-secondary-color, #8e867b);
  border-bottom: 1px solid var(--border-primary-color, #c7c0b6);
  white-space: nowrap;
}

.top-users-table td {
  padding: 10px;
  font-size: 13px;
  border-bottom: 1px solid var(--border-secondary-color, #d9d1c7);
  vertical-align: middle;
  white-space: nowrap;
}

.top-users-table tbody tr:last-child td {
  border-bottom: none;
}

.top-users-table tbody tr:hover td {
  background: var(--bg-overlay-primary-color, rgba(142, 134, 123, 0.1));
}

.top-users-table__user {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.top-users-table__avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--bg-accent-color, #e3eae6);
  color: var(--fg-accent-color, #4b8266);
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.top-users-table__name {
  font-weight: 600;
  color: var(--fg-accent-color, #4b8266);
  line-height: 1.2;
}

.top-users-table__sub {
  font-size: 11.5px;
  color: var(--fg-secondary-color, #8e867b);
}

.top-users-table__strong {
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
}

.top-users-table__muted {
  color: var(--fg-secondary-color, #8e867b);
}

.text-right {
  text-align: right;
}

.top-users-empty {
  text-align: center;
  padding: 28px;
  font-size: 13px;
  color: var(--fg-secondary-color, #8e867b);
}
</style>
