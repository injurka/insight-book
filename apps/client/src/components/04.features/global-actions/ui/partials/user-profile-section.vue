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

    <div class="limits-section" @click="openLimits">
      <div class="limits-content">
        <!-- ИИ Токены -->
        <div class="limit-widget-item">
          <div class="widget-header">
            <div class="widget-title">
              <Icon icon="mdi:brain" />
              <span>{{ t('globalActions.aiTokens') }}</span>
            </div>
            <div class="widget-usage">
              <strong>{{ formatNumber(authStore.user?.usedTokens) }}</strong> /
              {{ authStore.user?.tokenLimit !== null && authStore.user?.tokenLimit !== undefined ? formatNumber(authStore.user?.tokenLimit) : '∞' }}
            </div>
          </div>
          <div v-if="authStore.user?.tokenLimit !== null && authStore.user?.tokenLimit !== undefined" class="progress-bar-container">
            <div
              class="progress-bar"
              :style="{ width: `${tokenPercent}%` }"
              :class="{ 'is-full': tokenPercent >= 100, 'is-high': tokenPercent > 80 && tokenPercent < 100 }"
            />
          </div>
        </div>

        <!-- Лимит книг -->
        <div class="limit-widget-item">
          <div class="widget-header">
            <div class="widget-title">
              <Icon icon="mdi:book-multiple-outline" />
              <span>{{ t('globalActions.booksLimit') }}</span>
            </div>
            <div class="widget-usage">
              <strong>{{ authStore.user?.usedBooks || 0 }}</strong> /
              {{ authStore.user?.bookLimit !== null && authStore.user?.bookLimit !== undefined ? authStore.user?.bookLimit : '∞' }}
            </div>
          </div>
          <div v-if="authStore.user?.bookLimit !== null && authStore.user?.bookLimit !== undefined" class="progress-bar-container">
            <div
              class="progress-bar"
              :style="{ width: `${bookPercent}%` }"
              :class="{ 'is-full': bookPercent >= 100, 'is-high': bookPercent > 80 && bookPercent < 100 }"
            />
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
  padding: 12px 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.user-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;

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
  gap: 8px;
  background-color: var(--bg-secondary-color);
  padding: 12px;
  border-radius: var(--r-m, 12px);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    transform 0.2s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    transform: translateY(-2px);

    .limits-chevron {
      color: var(--fg-accent-color);
    }
  }

  .limits-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex-grow: 1;
    min-width: 0;
  }

  .limits-chevron {
    font-size: 1.25rem;
    color: var(--fg-secondary-color);
    transition: color 0.2s;
    flex-shrink: 0;
  }

  .limit-widget-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
  }

  .widget-title {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--fg-secondary-color);
    font-weight: 500;

    svg {
      font-size: 1rem;
      flex-shrink: 0;
    }
  }

  .widget-usage {
    color: var(--fg-primary-color);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;

    strong {
      font-weight: 600;
    }
  }

  .progress-bar-container {
    width: 100%;
    height: 6px;
    background-color: var(--bg-tertiary-color);
    border-radius: var(--r-full, 9999px);
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background-color: var(--fg-accent-color);
    border-radius: var(--r-full, 9999px);
    transition: width 0.4s ease-in-out;

    &.is-high {
      background-color: var(--fg-warning-color);
    }
    &.is-full {
      background-color: var(--fg-error-color);
    }
  }
}
</style>
