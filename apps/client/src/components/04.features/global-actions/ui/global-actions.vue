<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitDropdown, KitSelect } from '~/components/01.kit'
import { ThemesVariant, useChangeTheme } from '~/shared/composables/use-change-theme'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'
import { usePwaStore } from '~/shared/store/pwa.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

interface Props {
  hideDictionary?: boolean
}

defineProps<Props>()

const router = useRouter()
const authStore = useAuthStore()
const pwaStore = usePwaStore()
const { theme, toggleTheme } = useChangeTheme()
const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()

const appLangOptions = [
  { label: 'Русский', value: 'ru' },
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
]

function formatNumber(num: number | undefined | null) {
  if (num == null)
    return '0'
  return new Intl.NumberFormat('ru-RU').format(num)
}

const tokenPercent = computed(() => {
  if (!authStore.user?.tokenLimit)
    return 0
  return Math.min(100, Math.round(((authStore.user.usedTokens || 0) / authStore.user.tokenLimit) * 100))
})

const bookPercent = computed(() => {
  if (!authStore.user?.bookLimit)
    return 0
  return Math.min(100, Math.round(((authStore.user.usedBooks || 0) / authStore.user.bookLimit) * 100))
})

function setLanguage(lang: string) {
  settingsStore.appLanguage = lang

  if (authStore.user) {
    pwaStore.updatePushSettings({
      deckId: authStore.user.pushTargetDeckId ?? 'all',
      timeStart: authStore.user.pushTimeStart || '10:00',
      timeEnd: authStore.user.pushTimeEnd || '21:00',
    }).catch(() => {})
  }
}

function openDictionary() {
  router.push(AppRoutePaths.Dictionary)
}

function openSettings() {
  router.push(AppRoutePaths.Settings)
}

function handleSignIn() {
  router.push(AppRoutePaths.SignIn)
}

function handleLogout() {
  authStore.logout()
  window.location.reload()
}
</script>

<template>
  <div class="global-actions">
    <!-- Для неавторизованных в multi-mode: кнопки в ряд -->
    <template v-if="!authStore.isSingleMode && !authStore.user">
      <KitDropdown placement="bottom-end" width="160px">
        <template #activator="{ props: dropdownProps }">
          <KitBtn
            icon="mdi:translate"
            variant="text"
            :aria-label="t('globalActions.switchLanguage')"
            :class="{ 'is-active-btn': dropdownProps.isOpen }"
          />
        </template>
        <div class="dropdown-menu-list">
          <button
            v-for="lang in appLangOptions"
            :key="lang.value"
            class="dropdown-item"
            :class="{ 'is-active': settingsStore.appLanguage === lang.value }"
            @click="setLanguage(lang.value)"
          >
            {{ lang.label }}
          </button>
        </div>
      </KitDropdown>
      <KitBtn
        :icon="theme === ThemesVariant.Light ? 'mdi:weather-night' : 'mdi:weather-sunny'"
        variant="text"
        :aria-label="t('globalActions.switchTheme')"
        @click="toggleTheme"
      />

      <KitBtn color="primary" variant="tonal" @click="handleSignIn">
        {{ t('globalActions.signIn') }}
      </KitBtn>
    </template>

    <!-- Для авторизованных или single-mode: единое меню -->
    <template v-else>
      <KitDropdown placement="bottom-end" width="280px">
        <template #activator="{ props: dropdownProps }">
          <KitBtn
            :icon="authStore.isSingleMode ? 'mdi:cog-outline' : 'mdi:account-circle-outline'"
            variant="text"
            :class="{ 'is-active-btn': dropdownProps.isOpen }"
          />
        </template>

        <div class="dropdown-panel">
          <!-- Профиль и Лимиты -->
          <div v-if="!authStore.isSingleMode" class="user-profile">
            <div class="user-header">
              <div class="user-avatar">
                <Icon icon="mdi:account-circle" />
              </div>
              <div class="user-info">
                <span class="username">{{ authStore.user?.username }}</span>
                <span class="role-badge">{{ authStore.user?.role === 'admin' ? t('globalActions.roleAdmin') : t('globalActions.roleUser') }}</span>
              </div>
            </div>

            <div v-if="authStore.user?.role !== 'admin'" class="limits-section">
              <!-- ИИ Токены -->
              <div class="limit-item">
                <div class="limit-labels">
                  <span>{{ t('globalActions.aiTokens') }}</span>
                  <span>{{ formatNumber(authStore.user?.usedTokens) }} / {{ authStore.user?.tokenLimit ? formatNumber(authStore.user?.tokenLimit) : '∞' }}</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: `${tokenPercent}%` }" />
                </div>
              </div>

              <!-- Лимит книг -->
              <div class="limit-item">
                <div class="limit-labels">
                  <span>{{ t('globalActions.booksLimit') }}</span>
                  <span>{{ authStore.user?.usedBooks || 0 }} / {{ authStore.user?.bookLimit ? authStore.user?.bookLimit : '∞' }}</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: `${bookPercent}%` }" />
                </div>
              </div>
            </div>
          </div>

          <div v-if="!authStore.isSingleMode" class="divider" />

          <!-- Меню действий -->
          <div class="menu-items">
            <button v-if="!hideDictionary" class="menu-btn" @click="openDictionary">
              <Icon icon="mdi:book-alphabet" /> <span class="flex-grow">{{ t('globalActions.myDictionary') }}</span>
            </button>
            <button class="menu-btn" @click="openSettings">
              <Icon icon="mdi:database-outline" /> <span class="flex-grow">{{ t('globalActions.storageManagement') }}</span>
            </button>

            <div class="divider" />

            <button class="menu-btn" @click="toggleTheme">
              <Icon :icon="theme === 'light' ? 'mdi:weather-sunny' : 'mdi:weather-night'" />
              <span class="flex-grow">{{ t('globalActions.theme') }}</span>
              <span class="row-value">{{ theme === 'light' ? t('reader.light') : t('reader.dark') }}</span>
            </button>

            <div class="menu-btn pseudo-btn">
              <Icon icon="mdi:translate" />
              <span class="flex-grow">{{ t('globalActions.language') }}</span>
              <KitSelect
                v-model="settingsStore.appLanguage"
                :options="appLangOptions"
                size="xs"
                class="seamless-select"
                @update:model-value="setLanguage($event as string)"
              />
            </div>

            <div v-if="!authStore.isSingleMode" class="divider" />

            <button v-if="!authStore.isSingleMode" class="menu-btn text-error" @click="handleLogout">
              <Icon icon="mdi:logout" /> <span class="flex-grow">{{ t('globalActions.signOut') }}</span>
            </button>
          </div>
        </div>
      </KitDropdown>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.global-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-left: 12px;
}

.is-active-btn {
  color: var(--fg-accent-color) !important;
}

.dropdown-menu-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--fg-primary-color);
  font-size: 0.95rem;
  font-family: inherit;
  cursor: pointer;
  border-radius: 6px;
  transition:
    background-color 0.2s,
    color 0.2s;
  text-align: left;

  &:hover,
  &.is-active {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }
}

.dropdown-panel {
  display: flex;
  flex-direction: column;
}

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
    font-size: 2.2rem;
    color: var(--fg-accent-color);
    opacity: 0.9;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .username {
      font-weight: 600;
      font-size: 1.05rem;
      color: var(--fg-primary-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .role-badge {
      font-size: 0.75rem;
      color: var(--fg-secondary-color);
    }
  }
}

.limits-section {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .limit-item {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .limit-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: var(--fg-secondary-color);
      font-variant-numeric: tabular-nums;
    }

    .progress-bar {
      height: 4px;
      background: var(--bg-tertiary-color);
      border-radius: 2px;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        background: var(--fg-accent-color);
        transition: width 0.3s ease;
      }
    }
  }
}

.menu-items {
  display: flex;
  flex-direction: column;
  padding: 6px;
  gap: 2px;
}

.flex-grow {
  flex-grow: 1;
  text-align: left;
}

.menu-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--fg-primary-color);
  font-size: 0.95rem;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    color 0.2s;

  svg {
    font-size: 1.25rem;
    color: var(--fg-secondary-color);
    transition: color 0.2s;
    flex-shrink: 0;
  }

  .row-value {
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
    font-weight: 500;
    transition: color 0.2s;
  }

  &:hover:not(.pseudo-btn) {
    background: var(--bg-hover-color);
    color: var(--fg-accent-color);
    svg {
      color: var(--fg-accent-color);
    }
    .row-value {
      color: var(--fg-accent-color);
    }
  }

  &.pseudo-btn {
    cursor: default;
    padding-right: 4px; /* Компенсация внутреннего отступа kit-select */
  }

  &.text-error {
    color: var(--fg-error-color);
    svg {
      color: var(--fg-error-color);
    }
    &:hover {
      background: rgba(var(--bg-error-color-rgb, 248, 81, 73), 0.1);
    }
  }
}

.seamless-select {
  width: auto;

  :deep(.kit-select-trigger) {
    border: none;
    background: transparent;
    padding: 0 8px;
    height: auto;
    box-shadow: none;
    color: var(--fg-secondary-color);
    font-weight: 500;
    font-size: 0.85rem;

    &:hover,
    &.is-open {
      color: var(--fg-accent-color);
      background: transparent;
    }

    .selected-label {
      text-align: right;
    }

    .trigger-icon {
      margin-left: 2px;
      font-size: 1.15rem;
      color: inherit;
    }
  }
}

.divider {
  height: 1px;
  background-color: var(--border-secondary-color);
  margin: 4px 0;
}
</style>
