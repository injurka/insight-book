<script setup lang="ts">
import { useRouter } from 'vue-router'
import { KitBtn, KitTooltip } from '~/components/01.kit'
import { ThemesVariant, useChangeTheme } from '~/shared/composables/use-change-theme'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useAuthStore } from '~/shared/store/auth.store'

interface Props {
  hideDictionary?: boolean
}

defineProps<Props>()

const router = useRouter()
const authStore = useAuthStore()
const { theme, toggleTheme } = useChangeTheme()

function openDictionary() {
  router.push(AppRoutePaths.Dictionary)
}

function openSettings() {
  router.push(AppRoutePaths.Settings)
}

function handleLogin() {
  router.push(AppRoutePaths.Login)
}

function handleLogout() {
  authStore.logout()
  window.location.reload()
}
</script>

<template>
  <div class="global-actions">
    <KitTooltip v-if="authStore.user && !hideDictionary" text="Мой словарь" placement="bottom">
      <KitBtn
        icon="mdi:book-alphabet"
        variant="text"
        aria-label="Мой словарь"
        @click="openDictionary"
      />
    </KitTooltip>

    <KitTooltip text="Управление памятью" placement="bottom">
      <KitBtn
        icon="mdi:database-outline"
        variant="text"
        aria-label="Память и Оффлайн"
        @click="openSettings"
      />
    </KitTooltip>

    <KitTooltip text="Переключить тему" placement="bottom-end">
      <KitBtn
        :icon="theme === ThemesVariant.Light ? 'mdi:weather-night' : 'mdi:weather-sunny'"
        variant="text"
        aria-label="Переключить тему"
        @click="toggleTheme"
      />
    </KitTooltip>

    <KitTooltip v-if="!authStore.isSingleMode && !authStore.user" text="Войти" placement="bottom-end">
      <KitBtn
        icon="mdi:login"
        variant="text"
        aria-label="Войти"
        @click="handleLogin"
      />
    </KitTooltip>

    <KitTooltip v-if="!authStore.isSingleMode && authStore.user" text="Выйти" placement="bottom-end">
      <KitBtn
        icon="mdi:logout"
        variant="text"
        aria-label="Выйти"
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
</style>
