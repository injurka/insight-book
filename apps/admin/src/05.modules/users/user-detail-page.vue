<script setup lang="ts">
import type { AdminUserDetailedAnalytics, SubscriptionTier, UserDetail } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRepos } from '~/00.plugins/di'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'
import { DEFAULT_SUBSCRIPTION_TIERS } from '~/03.domain/user'
import UserProfileHeader from './components/user-profile-header.vue'
import UserActivityPanel from './user-activity-panel.vue'
import UserEditForm from './user-edit-form.vue'

type UserDetailTab = 'activity' | 'settings'

interface Props {
  id: string
}

const props = defineProps<Props>()

const { admin } = useRepos()
const route = useRoute()
const router = useRouter()

const user = ref<UserDetail | null>(null)
const analytics = ref<AdminUserDetailedAnalytics | null>(null)
const tiers = ref<SubscriptionTier[]>(DEFAULT_SUBSCRIPTION_TIERS)
const activeTab = ref<UserDetailTab>(route.query.tab === 'settings' ? 'settings' : 'activity')
const loading = ref(true)
const error = ref('')

const tabs: Array<{ value: UserDetailTab, label: string, icon: string }> = [
  { value: 'activity', label: 'Обзор и активность', icon: 'mdi:chart-timeline-variant' },
  { value: 'settings', label: 'Настройки аккаунта', icon: 'mdi:account-cog-outline' },
]

function selectTab(tab: UserDetailTab) {
  if (activeTab.value === tab)
    return

  activeTab.value = tab
  router.replace({ query: tab === 'activity' ? {} : { tab } })
}

async function load() {
  loading.value = true
  error.value = ''

  const userId = Number(props.id)

  try {
    const [userRes, analyticsRes, tiersRes] = await Promise.allSettled([
      admin.getUser(userId),
      admin.getUserAnalytics(userId),
      admin.getSubscriptionTiers(),
    ])

    if (tiersRes.status === 'fulfilled' && tiersRes.value.length)
      tiers.value = tiersRes.value

    if (analyticsRes.status === 'fulfilled')
      analytics.value = analyticsRes.value

    if (userRes.status === 'fulfilled') {
      user.value = userRes.value
    }
    else {
      throw userRes.reason
    }
  }
  catch (e: unknown) {
    error.value = (e as Error).message || 'Не удалось загрузить профиль пользователя'
  }
  finally {
    loading.value = false
  }
}

function handleDeleted() {
  router.push({ name: 'users' })
}

watch(() => props.id, () => load())
watch(() => route.query.tab, (val) => {
  activeTab.value = val === 'settings' ? 'settings' : 'activity'
})

onMounted(() => load())
</script>

<template>
  <div class="user-page">
    <div class="user-page__topbar">
      <RouterLink to="/users" class="user-page__back">
        <Icon icon="mdi:arrow-left" />
        <span>Пользователи</span>
      </RouterLink>

      <KitBtn
        variant="ghost"
        :disabled="loading"
        title="Обновить"
        @click="load"
      >
        <Icon icon="mdi:refresh" />
      </KitBtn>
    </div>

    <KitError v-if="error" :message="error" />

    <div v-if="loading && !user" class="user-page__skeletons">
      <KitSkeleton height="190px" />
      <KitSkeleton height="320px" />
    </div>

    <template v-else-if="user">
      <UserProfileHeader
        :user="user"
        :analytics="analytics"
        :tiers="tiers"
      />

      <div class="user-page__tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.value"
          class="user-page__tab"
          :class="{ 'user-page__tab--active': activeTab === tab.value }"
          @click="selectTab(tab.value)"
        >
          <Icon :icon="tab.icon" class="user-page__tab-icon" />
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <div v-if="activeTab === 'activity'" class="user-page__panel">
        <UserActivityPanel v-if="analytics" :analytics="analytics" />
        <KitSkeleton v-else height="260px" />
      </div>

      <div v-else class="user-page__settings">
        <UserEditForm
          :user="user"
          :tiers="tiers"
          @saved="load"
          @deleted="handleDeleted"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.user-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 1320px;
}

.user-page__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.user-page__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--fg-secondary-color, #8e867b);
  text-decoration: none;
  transition: color 0.15s;
}

.user-page__back:hover {
  color: var(--fg-accent-color, #4b8266);
}

.user-page__skeletons {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.user-page__tabs {
  display: inline-flex;
  align-self: flex-start;
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 10px;
  padding: 4px;
  gap: 4px;
}

.user-page__tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--fg-secondary-color, #8e867b);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.user-page__tab:hover {
  color: var(--fg-primary-color, #4a443c);
}

.user-page__tab--active {
  background: var(--bg-primary-color, #f3efe9);
  color: var(--fg-primary-color, #4a443c);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(74, 68, 60, 0.08);
}

.user-page__tab--active .user-page__tab-icon {
  color: var(--fg-accent-color, #4b8266);
}

.user-page__tab-icon {
  font-size: 17px;
}

.user-page__panel {
  min-width: 0;
}

.user-page__settings {
  max-width: 680px;
}
</style>
