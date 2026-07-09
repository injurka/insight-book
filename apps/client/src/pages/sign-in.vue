<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { isTauri } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { v4 as uuidv4 } from 'uuid'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitDropdown, KitInput } from '~/components/01.kit'
import { ThemesVariant, useChangeTheme } from '~/shared/composables/use-change-theme'
import { useToast } from '~/shared/composables/use-toast'
import { useUmami } from '~/shared/composables/use-umami'
import { loadLanguageAsync } from '~/shared/plugins/i18n'
import { api, BASE_API_URL } from '~/shared/services/api.service'
import { useAuthStore } from '~/shared/store/auth.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()
const { trackEvent } = useUmami()

const settingsStore = useGlobalSettingsStore()
const { theme, toggleTheme } = useChangeTheme()

const currentThemeIcon = computed(() => {
  switch (theme.value) {
    case ThemesVariant.Light: return 'mdi:weather-sunny'
    case ThemesVariant.Dark: return 'mdi:weather-night'
    case ThemesVariant.Sepia: return 'mdi:book-open-page-variant'
    case ThemesVariant.Green: return 'mdi:leaf'
    case ThemesVariant.Oled: return 'mdi:moon-waning-crescent'
    default: return 'mdi:weather-sunny'
  }
})

const appLangOptions = [
  { label: 'Русский', value: 'ru' },
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
]

async function setLanguage(lang: string) {
  await loadLanguageAsync(lang)
  settingsStore.appLanguage = lang
  trackEvent('app_language_changed', { language: lang })
}

const username = ref('')
const email = ref('')
const password = ref('')
const code = ref('')
const isLoading = ref(false)
const isCodeSent = ref(false)
const currentTab = ref<'login' | 'register'>('login')

async function handleSignIn() {
  if (!username.value || !password.value)
    return
  isLoading.value = true

  try {
    const res = await api.auth.login({ login: username.value, password: password.value })
    localStorage.setItem('insight_token', res.token)
    await authStore.checkAuth()

    trackEvent('login_success')
    router.push('/')
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : t('signIn.errorAuth'))
  }
  finally {
    isLoading.value = false
  }
}

async function handleSendCode() {
  if (!email.value)
    return
  isLoading.value = true
  try {
    await api.auth.sendCode({ email: email.value })
    isCodeSent.value = true
    toast.success('Код отправлен на почту')
  }
  catch (e: any) {
    toast.error(e.message)
  }
  finally {
    isLoading.value = false
  }
}

async function handleRegister() {
  if (!email.value || !code.value || !password.value)
    return
  isLoading.value = true
  try {
    const res = await api.auth.register({ email: email.value, code: code.value, password: password.value })
    localStorage.setItem('insight_token', res.token)
    await authStore.checkAuth()
    trackEvent('register_success')
    router.push('/')
  }
  catch (e: any) {
    toast.error(e.message)
  }
  finally {
    isLoading.value = false
  }
}

let pollingInterval: any = null

async function loginYandex() {
  try {
    if (isTauri()) {
      isLoading.value = true

      const sessionId = uuidv4()
      const url = `${BASE_API_URL}/api/auth/yandex?session_id=${sessionId}`

      await openUrl(url)

      pollingInterval = setInterval(async () => {
        try {
          const res = await fetch(`${BASE_API_URL}/api/auth/status?session_id=${sessionId}`)
          const data = await res.json()

          if (data.status === 'success') {
            clearInterval(pollingInterval)
            localStorage.setItem('insight_token', data.token)
            await authStore.checkAuth()
            trackEvent('login_success')
            router.push('/')
          }
        }
        catch {
          // Игнорируем сетевые ошибки пуллинга
        }
      }, 2000)
    }
    else {
      window.location.href = `${BASE_API_URL}/api/auth/yandex`
    }
  }
  catch (e: any) {
    console.error('Yandex login error:', e)
    isLoading.value = false
    toast.error(e.message || 'Error opening Yandex login')
  }
}

const bookTiles = [
  { top: '8%', left: '10%', delay: '0s', size: 52, hue: 260 },
  { top: '12%', left: '55%', delay: '0.6s', size: 40, hue: 300 },
  { top: '28%', left: '28%', delay: '1.2s', size: 64, hue: 220 },
  { top: '45%', left: '68%', delay: '0.3s', size: 44, hue: 280 },
  { top: '60%', left: '15%', delay: '0.9s', size: 56, hue: 240 },
  { top: '72%', left: '45%', delay: '1.5s', size: 36, hue: 320 },
  { top: '82%', left: '72%', delay: '0.4s', size: 48, hue: 200 },
  { top: '38%', left: '5%', delay: '1.8s', size: 32, hue: 270 },
  { top: '20%', left: '80%', delay: '2.1s', size: 58, hue: 250 },
  { top: '65%', left: '35%', delay: '0.7s', size: 42, hue: 290 },
]

const showAuthControls = ref(false)
let pressTimer: any = null

function startPress() {
  if (showAuthControls.value)
    return

  pressTimer = setTimeout(() => {
    showAuthControls.value = true
  }, 1000)
}

function cancelPress() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}

onUnmounted(() => {
  if (pollingInterval)
    clearInterval(pollingInterval)
  if (pressTimer)
    clearTimeout(pressTimer)
})
</script>

<template>
  <div class="sign-in-root">
    <aside class="deco-panel" aria-hidden="true">
      <div
        v-for="(tile, i) in bookTiles"
        :key="i"
        class="book-tile"
        :style="{
          top: tile.top,
          left: tile.left,
          animationDelay: tile.delay,
          width: `${tile.size}px`,
          height: `${Math.round(tile.size * 1.42)}px`,
          background: `linear-gradient(145deg, rgba(var(--fg-accent-color-rgb), ${0.2 + (i % 4) * 0.15}), rgba(var(--bg-accent-color-rgb), ${0.4 + (i % 3) * 0.2}))`,
          boxShadow: `4px 6px 20px rgba(var(--bg-accent-color-rgb), 0.3), inset 1px 0 0 rgba(var(--fg-accent-color-rgb), 0.2)`,
        }"
      />

      <div class="grid-overlay" />

      <div class="deco-logo" @click="router.push('/')">
        <div class="deco-logo-icon">
          <Icon icon="mdi:book-open-page-variant" />
        </div>
        <div class="deco-logo-text">
          <span class="logo-name">Insight</span>
          <span class="logo-sub">Book</span>
        </div>
        <p class="deco-tagline">
          {{ t('signIn.tagline') }}
        </p>
      </div>

      <div class="deco-stats">
        <div class="stat-item">
          <Icon icon="mdi:bookshelf" />
          <span>{{ t('signIn.statBook') }}</span>
        </div>
        <div class="stat-dot" />
        <div class="stat-item">
          <Icon icon="mdi:text-box-multiple" />
          <span>{{ t('signIn.statManga') }}</span>
        </div>
        <div class="stat-dot" />
        <div class="stat-item">
          <Icon icon="mdi:notebook" />
          <span>{{ t('signIn.statDict') }}</span>
        </div>
      </div>
    </aside>

    <main class="auth-panel">
      <div class="settings-bar">
        <KitDropdown width="140px" placement="bottom-end">
          <template #activator>
            <button class="settings-btn" :aria-label="t('globalActions.switchLanguage')">
              <Icon icon="mdi:translate" />
            </button>
          </template>
          <div class="lang-dropdown-list">
            <button
              v-for="lang in appLangOptions"
              :key="lang.value"
              class="lang-dropdown-item"
              :class="{ 'is-active': settingsStore.appLanguage === lang.value }"
              @click="setLanguage(lang.value)"
            >
              <span>{{ lang.label }}</span>
              <Icon v-if="settingsStore.appLanguage === lang.value" icon="mdi:check" class="check-icon" />
            </button>
          </div>
        </KitDropdown>

        <div class="settings-divider" />

        <button class="settings-btn" :aria-label="t('globalActions.switchTheme')" @click="toggleTheme">
          <Icon :icon="currentThemeIcon" />
        </button>
      </div>

      <div class="auth-card">
        <div class="auth-header">
          <div
            class="auth-badge"
            @mousedown="startPress"
            @touchstart="startPress"
            @mouseup="cancelPress"
            @mouseleave="cancelPress"
            @touchend="cancelPress"
            @touchcancel="cancelPress"
          >
            <Icon icon="mdi:lock-outline" />
            <span>{{ t('signIn.earlyAccess') }}</span>
          </div>
          <h1 class="auth-title">
            {{ t('signIn.title') }}
          </h1>
          <p class="auth-subtitle">
            {{ t('signIn.subtitle') }}
          </p>
        </div>

        <a
          href="#"
          class="yandex-btn yandex-btn-link"
          :class="{ 'is-disabled': isLoading }"
          @click.prevent="loginYandex"
        >
          <span class="yandex-btn-inner">
            <span class="yandex-icon-wrap">
              <span style="font-family: Arial, sans-serif; font-weight: bold; font-size: 1.3rem;">Я</span>
            </span>
            <span class="yandex-btn-label">{{ t('signIn.yandexLogin') }}</span>
          </span>
        </a>

        <div v-if="showAuthControls" class="divider">
          <span class="divider-line" />
          <span class="divider-text">{{ t('signIn.or') }}</span>
          <span class="divider-line" />
        </div>

        <div v-if="showAuthControls" class="auth-tabs">
          <button
            class="auth-tab-btn"
            :class="{ 'is-active': currentTab === 'login' }"
            type="button"
            @click="currentTab = 'login'"
          >
            {{ t('signIn.loginTab') }}
          </button>
          <button
            class="auth-tab-btn"
            :class="{ 'is-active': currentTab === 'register' }"
            type="button"
            @click="currentTab = 'register'"
          >
            {{ t('signIn.registerTab') }}
          </button>
        </div>

        <Transition name="fade" mode="out-in">
          <form v-if="showAuthControls && currentTab === 'login'" class="whitelist-form" @submit.prevent="handleSignIn">
            <KitInput
              v-model="username"
              :placeholder="t('signIn.loginOrEmail')"
              autocomplete="username"
            />
            <KitInput
              v-model="password"
              type="password"
              :placeholder="t('signIn.password')"
              autocomplete="current-password"
            />
            <KitBtn
              type="submit"
              color="primary"
              class="submit-btn"
              :disabled="isLoading"
            >
              <Icon v-if="isLoading" icon="mdi:loading" class="spin" />
              <span>{{ t('signIn.loginBtn') }}</span>
            </KitBtn>
          </form>

          <form v-else-if="showAuthControls" class="whitelist-form" @submit.prevent="isCodeSent ? handleRegister() : handleSendCode()">
            <KitInput
              v-model="email"
              type="email"
              placeholder="Email"
              autocomplete="email"
              :disabled="isCodeSent"
            />

            <template v-if="isCodeSent">
              <KitInput
                v-model="code"
                :placeholder="t('signIn.verificationCode')"
                autocomplete="one-time-code"
              />
              <KitInput
                v-model="password"
                type="password"
                :placeholder="t('signIn.createPassword')"
                autocomplete="new-password"
              />
            </template>

            <KitBtn
              type="submit"
              color="primary"
              class="submit-btn"
              :disabled="isLoading"
            >
              <Icon v-if="isLoading" icon="mdi:loading" class="spin" />
              <span>{{ isCodeSent ? t('signIn.registerBtn') : t('signIn.getCode') }}</span>
            </KitBtn>

            <button
              v-if="isCodeSent"
              type="button"
              class="back-btn"
              :disabled="isLoading"
              @click="isCodeSent = false"
            >
              {{ t('signIn.changeEmail') }}
            </button>
          </form>
        </Transition>
      </div>
    </main>
  </div>
</template>

<style scoped lang="scss">
.sign-in-root {
  padding-top: var(--safe-area-top);
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
  background: var(--bg-primary-color);

  @media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
}

.settings-bar {
  position: absolute;
  top: calc(20px + var(--safe-area-top));
  right: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(var(--bg-secondary-color-rgb), 0.7);
  border: 1px solid rgba(var(--border-primary-color-rgb), 0.5);
  border-radius: 14px;
  padding: 5px;
  backdrop-filter: blur(20px) saturate(160%);
  z-index: 100;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;

  &:hover {
    background: var(--bg-tertiary-color);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    transform: translateY(-1px);
  }

  @media (max-width: 480px) {
    top: 12px;
    right: 12px;
  }
}

.settings-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1.15rem;

  &:hover {
    background: var(--bg-accent-overlay-color);
    color: var(--fg-accent-color);
  }

  &:active {
    transform: scale(0.92);
  }
}

.settings-divider {
  width: 1px;
  height: 16px;
  border: 1px solid rgba(var(--border-primary-color-rgb), 0.3);
}

.lang-dropdown-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px;
}

.lang-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  gap: 10px;

  &:hover {
    background: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &.is-active {
    color: var(--fg-accent-color);
    background: var(--bg-accent-overlay-color);
    font-weight: 600;
  }

  .check-icon {
    font-size: 0.9rem;
  }
}

.deco-panel {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #0a0e14 0%, #110e1a 40%, #0f1520 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  @media (max-width: 768px) {
    flex: 0 0 320px;
    padding-bottom: 24px;
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 70% 60% at 40% 35%, rgba(var(--bg-accent-overlay-color-rgb), 0.2) 0%, transparent 70%),
      radial-gradient(ellipse 50% 40% at 70% 70%, rgba(var(--bg-accent-color-rgb), 0.1) 0%, transparent 65%);
    pointer-events: none;
  }
}

.grid-overlay {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(201, 117, 222, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(201, 117, 222, 0.04) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

.book-tile {
  position: absolute;
  border-radius: 4px;
  animation: book-float 6s ease-in-out infinite;
  will-change: transform, opacity;
  opacity: 0.55;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 35%;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, transparent 100%);
    border-radius: 4px 4px 0 0;
  }
}

@keyframes book-float {
  0%,
  100% {
    transform: translateY(0) rotate(var(--r, -3deg));
    opacity: 0.45;
  }
  50% {
    transform: translateY(-12px) rotate(var(--r, 3deg));
    opacity: 0.7;
  }
}

.book-tile:nth-child(odd) {
  --r: -4deg;
  animation-duration: 7s;
}
.book-tile:nth-child(even) {
  --r: 3deg;
  animation-duration: 5.5s;
}
.book-tile:nth-child(3n) {
  --r: -1deg;
  animation-duration: 8.5s;
}

.deco-logo {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
  cursor: pointer;
  user-select: none;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.deco-logo:hover {
  opacity: 0.9;
  transform: translateY(-2px);
}

.deco-logo:active {
  transform: translateY(0);
}

.deco-logo-icon {
  width: 80px;
  height: 80px;
  border-radius: 24px;
  background: linear-gradient(135deg, var(--bg-accent-color), var(--bg-tertiary-color));
  border: 1px solid rgba(var(--fg-accent-color-rgb), 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  color: var(--fg-accent-color);
  box-shadow:
    0 0 0 1px rgba(var(--fg-accent-color-rgb), 0.15),
    0 0 40px rgba(var(--fg-accent-color-rgb), 0.2),
    0 8px 32px rgba(0, 0, 0, 0.4);
  animation: pulse-glow 3s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgba(var(--fg-accent-color-rgb), 0.15),
      0 0 40px rgba(var(--fg-accent-color-rgb), 0.2),
      0 8px 32px rgba(0, 0, 0, 0.4);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(var(--fg-accent-color-rgb), 0.3),
      0 0 60px rgba(var(--fg-accent-color-rgb), 0.35),
      0 8px 32px rgba(0, 0, 0, 0.5);
  }
}

.deco-logo-text {
  display: flex;
  align-items: baseline;
  gap: 6px;

  .logo-name {
    font-size: 2.4rem;
    font-weight: 800;
    color: #c9d1d9;
    letter-spacing: -1.5px;
    line-height: 1;
  }

  .logo-sub {
    font-size: 2.4rem;
    font-weight: 300;
    color: var(--fg-accent-color);
    letter-spacing: -1px;
    line-height: 1;
  }
}

.deco-tagline {
  margin: 0;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  max-width: 220px;
  line-height: 1.5;
}

.deco-stats {
  position: absolute;
  bottom: 36px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 2;
  background: var(--bg-tertiary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 100px;
  padding: 10px 20px;
  backdrop-filter: blur(12px);
  white-space: nowrap;

  @media (max-width: 768px) {
    display: none;
  }
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--fg-primary-color);
  font-weight: 500;

  svg,
  .iconify {
    font-size: 1rem;
    color: var(--fg-accent-color);
    opacity: 0.8;
  }
}

.stat-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #30363d;
}

.auth-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  background-color: var(--bg-primary-color);
  background-image:
    linear-gradient(color-mix(in srgb, var(--fg-primary-color) 3%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--fg-primary-color) 3%, transparent) 1px, transparent 1px);
  background-size: 32px 32px;
  background-position: center top;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 1px;
    background: linear-gradient(
      to bottom,
      transparent,
      rgba(var(--fg-accent-color-rgb), 0.3) 30%,
      rgba(var(--fg-accent-color-rgb), 0.3) 70%,
      transparent
    );

    @media (max-width: 768px) {
      display: none;
    }
  }

  @media (max-width: 768px) {
    flex: 1 1 auto;
    padding: 32px 24px 60px;
    border-radius: 28px 28px 0 0;
    margin-top: -28px;
    z-index: 10;
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.3);
  }
}

.auth-card {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.auth-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 100px;
  background: var(--bg-accent-overlay-color);
  border: 1px solid var(--border-focus-color);
  color: var(--fg-accent-color);
  font-size: 0.78rem;
  font-weight: 600;
  width: fit-content;
  letter-spacing: 0.3px;
  cursor: pointer;
  user-select: none;

  svg,
  .iconify {
    font-size: 0.85rem;
  }
}

.auth-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  color: var(--fg-primary-color);
  letter-spacing: -0.8px;
  line-height: 1.15;
}

.auth-subtitle {
  margin: 0;
  font-size: 0.95rem;
  color: var(--fg-secondary-color);
  line-height: 1.5;
}

.yandex-btn {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-decoration: none !important;
  cursor: pointer !important;
  width: 100% !important;
  height: 52px !important;
  border-radius: 14px !important;
  padding: 0 !important;
  background: linear-gradient(135deg, #fc3f1d 0%, #d4320f 100%) !important;
  border: none !important;
  box-shadow: 0 4px 20px rgba(252, 63, 29, 0.3) !important;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;

  &:hover:not(.is-disabled) {
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 28px rgba(252, 63, 29, 0.45) !important;
    background: linear-gradient(135deg, #ff4d27 0%, #e0381a 100%) !important;
  }

  &:active:not(.is-disabled) {
    transform: translateY(0) !important;
  }

  &.is-disabled {
    opacity: 0.7 !important;
    pointer-events: none !important;
  }
}

.yandex-btn-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
}

.yandex-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  color: white;
  flex-shrink: 0;
}

.yandex-btn-label {
  font-size: 1rem;
  font-weight: 600;
  color: white;
  letter-spacing: 0.1px;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 4px;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: var(--border-secondary-color);
}

.divider-text {
  font-size: 0.8rem;
  color: var(--border-primary-color);
  font-weight: 500;
  white-space: nowrap;
}

.whitelist-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--border-primary-color);
  background: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;

  &:hover {
    border-color: var(--border-focus-color);
    background: var(--bg-focus-color);
    color: var(--fg-primary-color);
  }

  &.is-open {
    border-color: var(--border-focus-color);
    background: var(--bg-focus-color);
    color: var(--fg-accent-color);
  }
}

.whitelist-toggle-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 500;

  svg,
  .iconify {
    font-size: 1.05rem;
  }
}

.whitelist-toggle-chevron {
  font-size: 1.1rem;
  transition: transform 0.2s ease;
  color: inherit;

  .is-open & {
    transform: rotate(180deg);
  }
}

.whitelist-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
}

.submit-btn {
  width: 100% !important;
  height: 44px !important;
  border-radius: 10px !important;
  font-weight: 600 !important;
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 280px;
}

@media (max-width: 480px) {
  .auth-card {
    gap: 16px;
  }

  .auth-title {
    font-size: 1.7rem;
  }
}
</style>

<style scoped>
.auth-tabs {
  display: flex;
  gap: 8px;
  background: var(--bg-secondary-color);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--border-primary-color);
}

.auth-tab-btn {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.auth-tab-btn:hover {
  color: var(--fg-primary-color);
}

.auth-tab-btn.is-active {
  background: var(--bg-primary-color);
  color: var(--fg-primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.back-btn {
  background: transparent;
  border: none;
  color: var(--fg-secondary-color);
  margin-top: 8px;
  cursor: pointer;
  font-size: 0.9rem;
}
.back-btn:hover {
  text-decoration: underline;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
