<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitPrompt } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { AppRoutePaths } from '~/shared/constants/routes'
import { getMediaUrl } from '~/shared/lib/helpers'
import { useAuthStore } from '~/shared/store/auth.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

const emit = defineEmits(['closeDropdown'])

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()

const tokenPercent = computed(() => {
  const used = authStore.user?.usedTokens ?? 0
  const limit = authStore.user?.tokenLimit
  if (limit === null || limit === undefined)
    return 0
  if (limit === 0)
    return 100
  return Math.min(100, Math.round((used / limit) * 100))
})

const bookPercent = computed(() => {
  const used = authStore.user?.usedBooks ?? 0
  const limit = authStore.user?.bookLimit
  if (limit === null || limit === undefined)
    return 0
  if (limit === 0)
    return 100
  return Math.min(100, Math.round((used / limit) * 100))
})

function getPercentClass(percentage: number) {
  if (percentage < 70)
    return 'is-success'
  if (percentage <= 90)
    return 'is-warning'
  return 'is-error'
}

function formatNumber(num: number | undefined | null) {
  if (num == null)
    return '0'

  return new Intl.NumberFormat(settingsStore.appLanguage || 'ru-RU', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num)
}

const userRoleName = computed(() => {
  const role = authStore.user?.role
  if (!role || role === 'user')
    return t('globalActions.roleUser')
  if (role === 'admin')
    return t('globalActions.roleAdmin')

  return role.charAt(0).toUpperCase() + role.slice(1)
})

const avatarInputRef = ref<HTMLInputElement | null>(null)
const isUsernamePromptOpen = ref(false)

function triggerAvatarUpload() {
  avatarInputRef.value?.click()
}

async function onAvatarChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    try {
      await authStore.updateAvatar(target.files[0])
      toast.success(t('globalActions.avatarUpdated'))
    }
    catch (err) {
      toast.error(err instanceof Error ? err.message : (t('common.avatarLoadError') || 'Ошибка загрузки аватара'))
    }
  }
}

async function handleUsernameSubmit(newUsername: string) {
  try {
    await authStore.updateUsername(newUsername)
    toast.success(t('globalActions.usernameUpdated'))
  }
  catch (err) {
    toast.error(err instanceof Error ? err.message : (t('common.error') || 'Ошибка'))
  }
}

function openLimits() {
  emit('closeDropdown')
  router.push(AppRoutePaths.Limits)
}
</script>

<template>
  <div v-if="!authStore.isSingleMode" class="user-profile">
    <div class="user-header">
      <div class="user-avatar" :title="t('globalActions.changeAvatar')" @click="triggerAvatarUpload">
        <img
          v-if="authStore.user?.avatarUrl"
          :src="getMediaUrl(authStore.user.avatarUrl)"
          alt="Avatar"
          class="avatar-img"
        >
        <Icon v-else icon="mdi:account-circle" />
        <div class="avatar-overlay">
          <Icon icon="mdi:camera-plus" />
        </div>
      </div>
      <div class="user-info">
        <span class="username" :title="t('globalActions.changeUsername')" @click="isUsernamePromptOpen = true">
          {{ authStore.user?.username }}
        </span>
        <span class="role-badge">{{ userRoleName }}</span>
      </div>
    </div>

    <div v-if="authStore.user?.role !== 'admin'" class="limits-section" @click="openLimits">
      <div class="limits-content">
        <!-- ИИ Токены -->
        <div class="limit-item">
          <div class="limit-row">
            <span class="limit-title">{{ t('globalActions.aiTokens') }}</span>
            <span class="limit-value">
              {{ formatNumber(authStore.user?.usedTokens) }} /
              {{ authStore.user?.tokenLimit !== null && authStore.user?.tokenLimit !== undefined ? formatNumber(authStore.user?.tokenLimit) : '∞' }}
            </span>
          </div>
          <div v-if="authStore.user?.tokenLimit !== null && authStore.user?.tokenLimit !== undefined" class="limit-progress-track">
            <div class="limit-progress-bar" :style="{ width: `${tokenPercent}%` }" :class="getPercentClass(tokenPercent)" />
          </div>
        </div>

        <!-- Лимит книг -->
        <div class="limit-item">
          <div class="limit-row">
            <span class="limit-title">{{ t('globalActions.booksLimit') }}</span>
            <span class="limit-value">
              {{ authStore.user?.usedBooks || 0 }} /
              {{ authStore.user?.bookLimit !== null && authStore.user?.bookLimit !== undefined ? authStore.user?.bookLimit : '∞' }}
            </span>
          </div>
          <div v-if="authStore.user?.bookLimit !== null && authStore.user?.bookLimit !== undefined" class="limit-progress-track">
            <div class="limit-progress-bar" :style="{ width: `${bookPercent}%` }" :class="getPercentClass(bookPercent)" />
          </div>
        </div>
      </div>

      <Icon icon="mdi:chevron-right" class="limits-chevron" />
    </div>

    <KitPrompt
      v-model:visible="isUsernamePromptOpen"
      :title="t('globalActions.changeUsername')"
      :default-value="authStore.user?.username"
      @submit="handleUsernameSubmit"
    />
    <input ref="avatarInputRef" type="file" accept="image/*" hidden @change="onAvatarChange">
  </div>
</template>

<style lang="scss" scoped>
.user-profile {
  padding: 12px 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.user-header {
  display: flex;
  align-items: center;
  gap: 12px;

  .user-avatar {
    position: relative;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: var(--bg-tertiary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    overflow: hidden;
    flex-shrink: 0;

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    > svg {
      font-size: 2.2rem;
      color: var(--fg-accent-color);
    }

    .avatar-overlay {
      position: absolute;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
      svg {
        color: white;
        font-size: 1.4rem;
      }
    }

    &:hover .avatar-overlay {
      opacity: 1;
    }
  }

  .user-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    .username {
      font-weight: 600;
      font-size: 1.05rem;
      color: var(--fg-primary-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      border-bottom: 1px dashed transparent;
      transition:
        color 0.2s,
        border-color 0.2s;

      &:hover {
        color: var(--fg-accent-color);
        border-color: var(--fg-accent-color);
      }
    }

    .role-badge {
      font-size: 0.75rem;
      color: var(--fg-secondary-color);
    }
  }
}

.limits-section {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: var(--bg-tertiary-color);
  padding: 4px 6px;
  border-radius: 8px;
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition:
    border-color 0.2s,
    background-color 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
    background-color: var(--bg-hover-color);

    .limits-chevron {
      color: var(--fg-accent-color);
    }
  }

  .limits-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-grow: 1;
    min-width: 0;
  }

  .limits-chevron {
    font-size: 1.25rem;
    color: var(--fg-secondary-color);
    transition: color 0.2s;
    flex-shrink: 0;
  }

  .limit-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.85rem;

    .limit-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .limit-title {
      font-weight: 500;
      color: var(--fg-secondary-color);
      white-space: nowrap;
    }

    .limit-value {
      font-weight: 600;
      color: var(--fg-primary-color);
      font-variant-numeric: tabular-nums;
    }

    .limit-progress-track {
      height: 4px;
      background-color: var(--border-secondary-color);
      border-radius: 2px;
      overflow: hidden;
      width: 100%;
    }

    .limit-progress-bar {
      height: 100%;
      border-radius: 2px;
      transition:
        width 0.3s ease,
        background-color 0.3s ease;

      &.is-success {
        background-color: var(--fg-success-color);
      }
      &.is-warning {
        background-color: var(--fg-warning-color);
      }
      &.is-error {
        background-color: var(--fg-error-color);
      }
    }
  }
}
</style>
