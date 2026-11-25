<script setup lang="ts">
import type { SubscriptionTier } from '~/01.shared/types/models'
import type { AdminUserDetailedAnalytics, UserDetail } from '~/03.domain/user'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { BASE_API_URL } from '~/01.shared/lib/api'
import KitBadge from '~/02.kit/atoms/kit-badge.vue'
import { formatDate, getSegmentMeta } from '~/03.domain/user'
import { buildUserMetricTiles } from '../lib/build-metric-tiles'

interface Props {
  user: UserDetail
  analytics: AdminUserDetailedAnalytics | null
  tiers: SubscriptionTier[]
}

const props = defineProps<Props>()

const avatarFailed = ref(false)

watch(() => props.user.avatarUrl, () => {
  avatarFailed.value = false
})

const avatarSrc = computed(() => {
  const url = props.user.avatarUrl

  if (!url || avatarFailed.value)
    return null

  return url.startsWith('/') ? `${BASE_API_URL}${url}` : url
})

const tierName = computed(() => {
  const tier = props.tiers.find(t => t.id === props.user.subscriptionTier)

  return tier?.nameRu || tier?.nameEn || props.user.subscriptionTier
})

const segment = computed(() => (props.analytics ? getSegmentMeta(props.analytics.segment) : null))
const tiles = computed(() => buildUserMetricTiles(props.user, props.analytics))
</script>

<template>
  <header class="profile">
    <div class="profile__identity">
      <div class="profile__avatar">
        <img
          v-if="avatarSrc"
          :src="avatarSrc"
          alt=""
          class="profile__avatar-img"
          @error="avatarFailed = true"
        >
        <span v-else>{{ user.username.slice(0, 1).toUpperCase() }}</span>
      </div>

      <div class="profile__main">
        <div class="profile__name-row">
          <h1 class="profile__name">
            {{ user.username }}
          </h1>
          <div class="profile__badges">
            <KitBadge :variant="user.role === 'admin' ? 'admin' : 'user'">
              {{ user.role }}
            </KitBadge>
            <KitBadge :variant="user.subscriptionTier === 'free' ? 'free' : 'pro'">
              {{ tierName }}
            </KitBadge>
            <KitBadge v-if="segment" :variant="segment.badgeVariant">
              {{ segment.shortLabel }}
            </KitBadge>
          </div>
        </div>

        <div class="profile__meta">
          <span class="profile__meta-item">
            <Icon icon="mdi:email-outline" />
            {{ user.email || 'email не указан' }}
          </span>
          <span class="profile__meta-item">
            <Icon icon="mdi:identifier" />
            ID {{ user.id }}
          </span>
          <span class="profile__meta-item">
            <Icon icon="mdi:calendar-plus" />
            Регистрация {{ formatDate(user.createdAt) }}
          </span>
        </div>
      </div>
    </div>

    <div class="profile__tiles">
      <div v-for="tile in tiles" :key="tile.key" class="tile">
        <div class="tile__label">
          <Icon :icon="tile.icon" class="tile__icon" />
          {{ tile.label }}
        </div>
        <div class="tile__value">
          {{ tile.value }}
        </div>
        <div v-if="tile.progress" class="tile__bar">
          <div
            class="tile__bar-fill"
            :class="`tile__bar-fill--${tile.progress.level}`"
            :style="{ width: `${tile.progress.percent}%` }"
          />
        </div>
        <div v-else-if="tile.hint" class="tile__hint">
          {{ tile.hint }}
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.profile {
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 12px;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.profile__identity {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.profile__avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--bg-accent-color, #e3eae6);
  border: 2px solid var(--border-success-color, #7dae94);
  color: var(--fg-accent-color, #4b8266);
  font-size: 24px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.profile__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile__main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.profile__name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.profile__name {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  margin: 0;
  color: var(--fg-primary-color, #4a443c);
}

.profile__badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.profile__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  font-size: 13px;
  color: var(--fg-secondary-color, #8e867b);
}

.profile__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.profile__tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}

.tile {
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.tile__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
}

.tile__icon {
  font-size: 15px;
  color: var(--fg-accent-color, #4b8266);
}

.tile__value {
  font-size: 18px;
  font-weight: 700;
  color: var(--fg-primary-color, #4a443c);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile__hint {
  font-size: 11.5px;
  color: var(--fg-secondary-color, #8e867b);
  line-height: 1.35;
}

.tile__bar {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-tertiary-color, #d9d1c7);
  overflow: hidden;
  margin-top: 3px;
}

.tile__bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.tile__bar-fill--ok {
  background: var(--fg-accent-color, #4b8266);
}

.tile__bar-fill--warn {
  background: var(--fg-warning-color, #b38f2b);
}

.tile__bar-fill--danger {
  background: var(--fg-error-color, #c46d6d);
}
</style>
