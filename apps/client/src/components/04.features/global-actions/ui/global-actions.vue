<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitDropdown, KitTooltip } from '~/components/01.kit'
import { ThemesVariant, useChangeTheme } from '~/shared/composables/use-change-theme'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

interface Props {
  hideDictionary?: boolean
}

defineProps<Props>()

const router = useRouter()
const authStore = useAuthStore()
const { theme, toggleTheme } = useChangeTheme()
const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()

const appLangOptions = [
  { label: 'Русский', value: 'ru' },
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
]

function setLanguage(lang: string) {
  settingsStore.appLanguage = lang
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
    <KitTooltip v-if="authStore.user && !hideDictionary" :text="t('globalActions.myDictionary')" placement="bottom">
      <KitBtn
        icon="mdi:book-alphabet"
        variant="text"
        :aria-label="t('globalActions.myDictionary')"
        @click="openDictionary"
      />
    </KitTooltip>

    <KitTooltip v-if="authStore.user || authStore.isSingleMode" :text="t('globalActions.storageManagement')" placement="bottom">
      <KitBtn
        icon="mdi:database-outline"
        variant="text"
        :aria-label="t('globalActions.storageManagement')"
        @click="openSettings"
      />
    </KitTooltip>

    <KitTooltip :text="t('globalActions.switchTheme')" placement="bottom-end">
      <KitBtn
        :icon="theme === ThemesVariant.Light ? 'mdi:weather-night' : 'mdi:weather-sunny'"
        variant="text"
        :aria-label="t('globalActions.switchTheme')"
        @click="toggleTheme"
      />
    </KitTooltip>

    <KitDropdown placement="bottom-end" width="120px">
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

    <KitTooltip v-if="!authStore.isSingleMode && !authStore.user" :text="t('globalActions.signIn')" placement="bottom-end">
      <KitBtn
        icon="mdi:login"
        variant="text"
        :aria-label="t('globalActions.signIn')"
        @click="handleSignIn"
      />
    </KitTooltip>

    <KitTooltip v-if="!authStore.isSingleMode && authStore.user" :text="t('globalActions.signOut')" placement="bottom-end">
      <KitBtn
        icon="mdi:logout"
        variant="text"
        :aria-label="t('globalActions.signOut')"
        @click="handleLogout"
      />
    </KitTooltip>
  </div>
</template>

<style lang="scss" scoped>
.global-actions {
  display: flex;
  gap: 4px;
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
</style>
