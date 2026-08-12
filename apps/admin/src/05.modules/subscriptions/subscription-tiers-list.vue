<script setup lang="ts">
import type { SubscriptionTier } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitBadge from '~/02.kit/atoms/kit-badge.vue'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'

const { admin } = useRepos()

const tiers = ref<SubscriptionTier[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    tiers.value = await admin.getSubscriptionTiers()
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally { loading.value = false }
}

async function handleDelete(tier: SubscriptionTier) {
  if (!confirm(`Удалить тариф "${tier.nameRu || tier.id}"?`))
    return
  try {
    await admin.deleteSubscriptionTier(tier.id)
    await load()
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
}

function formatTokens(n: number | null) {
  return n === null ? '∞' : n.toLocaleString('ru-RU')
}

onMounted(() => load())
</script>

<template>
  <div>
    <div class="subscription-tiers-list__header">
      <h1 class="subscription-tiers-list__title">
        <Icon icon="mdi:card-account-details" class="subscription-tiers-list__title-icon" />
        <span>Подписки</span>
      </h1>
      <RouterLink to="/subscriptions/create" class="subscription-tiers-list__create-link">
        <KitBtn variant="primary">
          <Icon icon="mdi:plus" />
          <span>Создать тариф</span>
        </KitBtn>
      </RouterLink>
    </div>

    <KitError v-if="error" :message="error" />

    <table v-if="loading || tiers.length" class="subscription-tiers-list__table">
      <thead>
        <tr>
          <th>#</th>
          <th>Тариф</th>
          <th>Цена</th>
          <th>Лимиты (день)</th>
          <th>Популярный</th>
          <th style="width: 100px; text-align: right;">
            Действия
          </th>
        </tr>
      </thead>
      <tbody v-if="loading">
        <tr v-for="i in 4" :key="i" class="subscription-tiers-list__skeleton-row">
          <td>
            <KitSkeleton width="24px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="200px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="60px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="160px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="40px" height="20px" border-radius="10px" />
          </td>
          <td>
            <div class="subscription-tiers-list__actions">
              <KitSkeleton width="24px" height="24px" border-radius="4px" />
              <KitSkeleton width="24px" height="24px" border-radius="4px" />
            </div>
          </td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-for="tier in tiers" :key="tier.id">
          <td class="subscription-tiers-list__muted">
            {{ tier.sortOrder }}
          </td>
          <td>
            <RouterLink :to="`/subscriptions/${tier.id}`" class="subscription-tiers-list__name-link">
              <span class="subscription-tiers-list__badge">{{ tier.badgeRu || tier.id }}</span>
              {{ tier.nameRu || tier.nameEn || tier.id }}
            </RouterLink>
          </td>
          <td>
            {{ tier.price === 0 ? 'Бесплатно' : `${tier.price} ₽/мес` }}
          </td>
          <td class="subscription-tiers-list__muted subscription-tiers-list__small">
            {{ formatTokens(tier.dailyTokenLimit) }} токенов, {{ formatTokens(tier.dailyBookLimit) }} книг
          </td>
          <td>
            <KitBadge v-if="tier.isPopular" variant="pro">
              Popular
            </KitBadge>
            <span v-else class="subscription-tiers-list__muted">—</span>
          </td>
          <td>
            <div class="subscription-tiers-list__actions">
              <RouterLink :to="`/subscriptions/${tier.id}`" class="subscription-tiers-list__action-link">
                <KitBtn
                  variant="ghost"
                  style="padding: 4px 6px; font-size: 12px"
                  title="Редактировать"
                >
                  <Icon icon="mdi:pencil" />
                </KitBtn>
              </RouterLink>
              <KitBtn
                variant="ghost-danger"
                style="padding: 4px 6px; font-size: 12px"
                title="Удалить"
                @click="handleDelete(tier)"
              >
                <Icon icon="mdi:delete" />
              </KitBtn>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="!loading && !tiers.length && !error" class="subscription-tiers-list__empty">
      Тарифы не найдены
    </div>
  </div>
</template>

<style scoped>
.subscription-tiers-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.subscription-tiers-list__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  display: flex;
  align-items: center;
  gap: 10px;
}
.subscription-tiers-list__title-icon {
  color: var(--fg-accent-color, #4b8266);
  font-size: 28px;
}
.subscription-tiers-list__create-link {
  text-decoration: none;
}
.subscription-tiers-list__table {
  width: 100%;
  border-collapse: collapse;
}
.subscription-tiers-list__table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-secondary-color, #8e867b);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-primary-color, #c7c0b6);
}
.subscription-tiers-list__table td {
  padding: 10px 12px;
  font-size: 14px;
  border-bottom: 1px solid var(--border-secondary-color, #d9d1c7);
  vertical-align: middle;
}
.subscription-tiers-list__table tr:hover td {
  background: var(--bg-overlay-primary-color, rgba(142, 134, 123, 0.1));
}
.subscription-tiers-list__name-link {
  color: var(--fg-accent-color, #4b8266);
  text-decoration: none;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.subscription-tiers-list__badge {
  font-size: 13px;
}
.subscription-tiers-list__muted {
  color: var(--fg-secondary-color, #8e867b);
}
.subscription-tiers-list__small {
  font-size: 13px;
}
.subscription-tiers-list__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.subscription-tiers-list__action-link {
  text-decoration: none;
  display: inline-flex;
}
.subscription-tiers-list__empty {
  color: var(--fg-secondary-color, #8e867b);
  text-align: center;
  padding: 40px;
}
</style>
