<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { getMediaUrl } from '~/01.shared/lib/helpers'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitPrompt } from '~/02.kit/organisms/kit-prompt/ui'
import { useAccountSettings } from '../../../composables/use-account-settings'

const { t } = useI18n()
const { user, isUsernamePromptOpen, updateAvatar, updateUsername } = useAccountSettings()

const avatarInputRef = useTemplateRef<HTMLInputElement>('avatarInputRef')

function triggerAvatarUpload() {
  avatarInputRef.value?.click()
}

async function onAvatarChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    await updateAvatar(target.files[0])
    target.value = ''
  }
}

const userRoleName = computed(() => {
  const role = user.value?.role
  if (!role || role === 'user')
    return t('globalActions.roleUser', 'Пользователь')
  if (role === 'admin')
    return t('globalActions.roleAdmin', 'Администратор')

  return role.charAt(0).toUpperCase() + role.slice(1)
})
</script>

<template>
  <div v-if="user" class="settings-card user-profile-card">
    <div class="user-header">
      <div
        class="user-avatar"
        :title="t('globalActions.changeAvatar', 'Сменить аватар')"
        @click="triggerAvatarUpload"
      >
        <img
          v-if="user.avatarUrl"
          :src="getMediaUrl(user.avatarUrl)"
          alt="Avatar"
          class="avatar-img"
          @error="(e) => (e.target as HTMLImageElement).src = '/images/smth-wrong.png'"
        >
        <Icon v-else icon="mdi:account-circle" />
        <div class="avatar-overlay">
          <Icon icon="mdi:camera-plus" />
        </div>
      </div>

      <div class="user-details">
        <div class="username-row">
          <span
            class="username"
            :title="t('globalActions.changeUsername', 'Изменить имя')"
            @click="isUsernamePromptOpen = true"
          >
            {{ user.username }}
          </span>
          <KitBtn
            variant="text"
            size="sm"
            icon="mdi:pencil-outline"
            class="edit-btn"
            :aria-label="t('globalActions.changeUsername', 'Изменить имя')"
            @click="isUsernamePromptOpen = true"
          />
        </div>

        <div class="meta-row">
          <span v-if="user.email" class="user-email">
            <Icon icon="mdi:email-outline" />
            {{ user.email }}
          </span>
          <span class="role-badge">{{ userRoleName }}</span>
          <span v-if="user.subscriptionTier && user.subscriptionTier !== 'free'" class="tier-badge">
            {{ user.subscriptionTier.toUpperCase() }}
          </span>
        </div>
      </div>
    </div>

    <!-- Промпт смены имени пользователя -->
    <KitPrompt
      v-model:visible="isUsernamePromptOpen"
      :title="t('globalActions.changeUsername', 'Изменить имя пользователя')"
      :default-value="user.username"
      @submit="updateUsername"
    />

    <!-- Скрытый инпут загрузки аватара -->
    <input
      ref="avatarInputRef"
      type="file"
      accept="image/*"
      hidden
      @change="onAvatarChange"
    >
  </div>
</template>

<style lang="scss" scoped>
.settings-card {
  background: var(--bg-secondary-color);
  padding: 24px;
  border-radius: var(--r-m, 12px);
  border: 1px solid var(--border-secondary-color);
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.user-header {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-avatar {
  position: relative;
  width: 64px;
  height: 64px;
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
    font-size: 3rem;
    color: var(--fg-accent-color);
  }

  .avatar-overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;

    svg {
      color: white;
      font-size: 1.6rem;
    }
  }

  &:hover .avatar-overlay {
    opacity: 1;
  }
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  .username-row {
    display: flex;
    align-items: center;
    gap: 8px;

    .username {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      cursor: pointer;
      transition: color 0.2s;

      &:hover {
        color: var(--fg-accent-color);
      }
    }

    .edit-btn {
      padding: 4px;
      color: var(--fg-secondary-color);
    }
  }

  .meta-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .user-email {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.85rem;
    color: var(--fg-secondary-color);

    svg {
      font-size: 1rem;
    }
  }

  .role-badge {
    display: inline-block;
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: var(--r-full, 9999px);
    background-color: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    font-weight: 500;
  }

  .tier-badge {
    display: inline-block;
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 4px;
    background: linear-gradient(135deg, var(--color-primary, #22c55e) 0%, #16a34a 100%);
    color: #ffffff;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
}
</style>
