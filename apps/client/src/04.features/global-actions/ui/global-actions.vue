<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { loadLanguageAsync } from '~/00.plugins/i18n'
import { pluginManager } from '~/00.plugins/plugin-manager'
import { ThemesVariant, useChangeTheme } from '~/01.shared/composables/use-change-theme'
import { useUmami } from '~/01.shared/composables/use-umami'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { usePwaStore } from '~/01.shared/store/pwa.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitBtn, KitDropdown, KitSelect } from '~/02.kit/index.ts'
import UserProfileSection from './partials/user-profile-section.vue'

interface Props {
  hideDictionary?: boolean
  hideNotebook?: boolean
}

defineProps<Props>()

const router = useRouter()
const authStore = useAuthStore()
const pwaStore = usePwaStore()
const { theme, toggleTheme } = useChangeTheme()
const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const { trackEvent } = useUmami()

const currentThemeIcon = computed(() => {
  switch (theme.value) {
    case ThemesVariant.System: return 'mdi:theme-light-dark'
    case ThemesVariant.Light: return 'mdi:weather-sunny'
    case ThemesVariant.Dark: return 'mdi:weather-night'
    case ThemesVariant.Sepia: return 'mdi:book-open-page-variant'
    case ThemesVariant.Green: return 'mdi:leaf'
    case ThemesVariant.Oled: return 'mdi:moon-waning-crescent'
    default: return 'mdi:theme-light-dark'
  }
})

const currentThemeName = computed(() => {
  switch (theme.value) {
    case ThemesVariant.System: return t('reader.system')
    case ThemesVariant.Light: return t('reader.light')
    case ThemesVariant.Dark: return t('reader.dark')
    case ThemesVariant.Sepia: return t('reader.sepia')
    case ThemesVariant.Green: return t('reader.green')
    case ThemesVariant.Oled: return t('reader.oled')
    default: return t('reader.system')
  }
})

const appLangOptions = [
  { label: 'Русский', value: 'ru' },
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
]

const mainDropdownRef = ref<InstanceType<typeof KitDropdown> | null>(null)

async function setLanguage(lang: string) {
  await loadLanguageAsync(lang)

  settingsStore.appLanguage = lang

  trackEvent('app_language_changed', { language: lang })

  if (authStore.user) {
    pwaStore.updatePushSettings({
      deckId: authStore.user.pushTargetDeckId ?? 'all',
      timeStart: authStore.user.pushTimeStart || '10:00',
      timeEnd: authStore.user.pushTimeEnd || '21:00',
      pushCount: authStore.user.pushCount ?? 1,
    }).catch(() => {})
  }
}

function openDictionary() {
  mainDropdownRef.value?.close()
  router.push(AppRoutePaths.Dictionary)
}

function openNotebook() {
  mainDropdownRef.value?.close()
  router.push(AppRoutePaths.Notebook)
}

function openSettings() {
  mainDropdownRef.value?.close()
  router.push(AppRoutePaths.Settings)
}

function openPlugin(routeName: string) {
  mainDropdownRef.value?.close()
  router.push({ name: routeName })
}

function handleSignIn() {
  router.push(AppRoutePaths.SignIn)
}

async function handleLogout() {
  mainDropdownRef.value?.close()
  await authStore.logout()
  router.push(AppRoutePaths.SignIn)
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
            :ripple="false"
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
        :icon="currentThemeIcon"
        variant="text"
        :ripple="false"
        :aria-label="t('globalActions.switchTheme')"
        @click="toggleTheme"
      />

      <KitBtn color="primary" variant="tonal" @click="handleSignIn">
        {{ t('globalActions.signIn') }}
      </KitBtn>
    </template>

    <!-- Для авторизованных или single-mode: единое меню -->
    <template v-else>
      <KitBtn
        v-if="!hideDictionary"
        icon="mdi:book-open-page-variant-outline"
        variant="text"
        :ripple="false"
        :aria-label="t('globalActions.myDictionary')"
        @click="openDictionary"
      />
      <KitBtn
        v-if="!hideNotebook"
        icon="mdi:bookmark-outline"
        variant="text"
        :ripple="false"
        :aria-label="t('globalActions.myNotebook')"
        @click="openNotebook"
      />
      <KitDropdown
        ref="mainDropdownRef"
        placement="bottom-end"
        width="280px"
        :close-on-content-click="false"
      >
        <template #activator="{ props: dropdownProps }">
          <KitBtn
            :icon="authStore.isSingleMode ? 'mdi:cog-outline' : 'mdi:account-circle-outline'"
            variant="text"
            :ripple="false"
            :class="{ 'is-active-btn': dropdownProps.isOpen }"
            @click="!dropdownProps.isOpen && authStore.checkAuth()"
          />
        </template>

        <div class="dropdown-panel">
          <!-- Профиль и Лимиты -->
          <UserProfileSection @close-dropdown="mainDropdownRef?.close()" />

          <div v-if="!authStore.isSingleMode" class="divider" style="margin: 0 6px" />

          <!-- Меню действий -->
          <div class="menu-items">
            <!-- Плагины -->
            <template v-if="pluginManager.navItems.length > 0">
              <button
                v-for="item in pluginManager.navItems"
                :key="item.routeName"
                class="menu-btn"
                @click="openPlugin(item.routeName)"
              >
                <Icon :icon="item.icon || 'mdi:puzzle-outline'" />
                <span class="flex-grow">{{ item.titleKey ? t(item.titleKey) : item.title }}</span>
              </button>
              <div class="divider" />
            </template>
            <button class="menu-btn" @click="openSettings">
              <Icon icon="mdi:cog-outline" /> <span class="flex-grow">{{ t('settings.title') }}</span>
            </button>

            <div class="divider" />

            <button class="menu-btn" @click="toggleTheme">
              <Icon :icon="currentThemeIcon" />
              <span class="flex-grow">{{ t('globalActions.theme') }}</span>
              <span class="row-value">{{ currentThemeName }}</span>
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
    padding-right: 4px;
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
  background-color: var(--border-primary-color);
  margin: 4px 0;
}
</style>
