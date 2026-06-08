<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitCheckbox, KitInput, KitSelect, KitSkeleton, KitTooltip } from '~/components/01.kit'
import { HoverRevealBg } from '~/components/02.shared/hover-reveal-bg'
import { useToast } from '~/shared/composables/use-toast'
import { AppRoutePaths } from '~/shared/constants/routes'
import { api } from '~/shared/services/api.service'
import { useCacheStore } from '~/shared/store/cache.store'
import { usePwaStore } from '~/shared/store/pwa.store' // <-- НОВОЕ
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { formatBytes, formatNumber, formatPagesList } from '../lib/formatters'

const cacheStore = useCacheStore()
const settingsStore = useGlobalSettingsStore()
const pwaStore = usePwaStore()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const appLangOptions = [
  { label: 'Русский', value: 'ru' },
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
]

const tokensData = ref<{ stats: any[], daily: any[] } | null>(null)
const isTokensLoading = ref(true)
const expandedModels = ref<Record<string, boolean>>({})

async function fetchTokensInfo() {
  try {
    isTokensLoading.value = true
    tokensData.value = await api.activity.getTokens()
  }
  catch (e) {
    console.error('Failed to load token usage:', e)
  }
  finally {
    isTokensLoading.value = false
  }
}

onMounted(() => {
  cacheStore.loadStats()
  fetchTokensInfo()
  pwaStore.checkPushStatus() // <-- НОВОЕ
})

// <-- НОВАЯ ФУНКЦИЯ ДЛЯ PUSH -->
async function handlePushToggle() {
  try {
    await pwaStore.togglePushSubscription()
    if (pwaStore.isPushSubscribed) {
      toast.success(t('settings.pushEnabled'))
    }
    else {
      toast.info(t('settings.pushDisabled'))
    }
  }
  catch (err: any) {
    toast.error(err.message || t('settings.pushError'))
  }
}

const storagePercent = computed(() => {
  if (!cacheStore.deviceStorage || cacheStore.deviceStorage.quota === 0)
    return 0
  return Math.min(100, Math.round((cacheStore.deviceStorage.usage / cacheStore.deviceStorage.quota) * 100))
})

const activeBookStats = computed(() => {
  if (!cacheStore.stats?.bookStats)
    return {}
  const res: Record<string, any> = {}
  for (const [id, book] of Object.entries(cacheStore.stats.bookStats)) {
    if (book.sizeBytes > 0 || book.cachedPages.length > 0 || book.analysesCount > 0) {
      res[id] = book
    }
  }
  return res
})

const totalTokens = computed(() => {
  if (!tokensData.value)
    return { input: 0, output: 0 }
  return tokensData.value.stats.reduce((acc, curr) => {
    acc.input += curr.inputTokens
    acc.output += curr.outputTokens
    return acc
  }, { input: 0, output: 0 })
})

interface ModelStats {
  model: string
  input: number
  output: number
  actions: { action: string, input: number, output: number }[]
}

const tokensByModel = computed<ModelStats[]>(() => {
  if (!tokensData.value)
    return []
  const map = new Map<string, ModelStats>()

  tokensData.value.stats.forEach((s) => {
    if (!map.has(s.model)) {
      map.set(s.model, { model: s.model, input: 0, output: 0, actions: [] })
    }
    const existing = map.get(s.model)!
    existing.input += s.inputTokens
    existing.output += s.outputTokens
    existing.actions.push({
      action: s.action,
      input: s.inputTokens,
      output: s.outputTokens,
    })
  })

  const result = Array.from(map.values()).sort((a, b) => (b.input + b.output) - (a.input + a.output))

  result.forEach((m) => {
    m.actions.sort((a, b) => (b.input + b.output) - (a.input + a.output))
  })

  return result
})

function toggleModelExpand(model: string) {
  expandedModels.value[model] = !expandedModels.value[model]
}

const availableModels = ref<{ label: string, value: string }[]>([])
const isFetchingModels = ref(false)

async function fetchModels() {
  if (!settingsStore.customLlmUrl) {
    toast.warn('Сначала укажите URL API')
    return
  }

  isFetchingModels.value = true
  try {
    const baseUrl = settingsStore.customLlmUrl.replace(/\/$/, '')

    const res = await fetch(`${baseUrl}/models`, {
      headers: settingsStore.customLlmKey
        ? {
            Authorization: `Bearer ${settingsStore.customLlmKey}`,
          }
        : undefined,
    })

    if (!res.ok) {
      throw new Error(`Ошибка HTTP: ${res.status}`)
    }

    const data = await res.json()

    if (data && data.data && Array.isArray(data.data)) {
      availableModels.value = data.data.map((m: any) => ({
        label: m.id,
        value: m.id,
      }))

      if (availableModels.value.length > 0) {
        toast.success('Список моделей успешно загружен')

        if (!availableModels.value.some(m => m.value === settingsStore.customLlmModel)) {
          settingsStore.customLlmModel = availableModels.value[0].value
        }
      }
      else {
        toast.info('Сервер вернул пустой список')
        availableModels.value = []
      }
    }
    else {
      throw new Error('Неизвестный формат ответа сервера')
    }
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : 'Не удалось загрузить модели')
    availableModels.value = []
  }
  finally {
    isFetchingModels.value = false
  }
}
</script>

<template>
  <div class="cache-manager-page">
    <HoverRevealBg />

    <header class="page-header">
      <KitBtn icon="mdi:arrow-left" variant="text" @click="router.push(AppRoutePaths.Home)" />
      <div class="header-title">
        <h1>{{ t('settings.title') }}</h1>
        <p>{{ t('settings.subtitle') }}</p>
      </div>
    </header>

    <div class="content">
      <!-- Настройки Интерфейса -->
      <h2 class="section-title">
        {{ t('settings.interfaceTitle') }}
      </h2>
      <div class="settings-card lang-card">
        <div class="form-group">
          <label>{{ t('settings.appLanguage') }}</label>
          <KitSelect v-model="settingsStore.appLanguage" :options="appLangOptions" />
        </div>

        <div class="divider" style="margin: 16px 0;" />
        <div class="push-setting-row" style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-weight: 500; color: var(--fg-primary-color);">
              <Icon icon="mdi:bell-ring-outline" style="vertical-align: text-bottom; font-size: 1.1em; color: var(--fg-accent-color);" />
              {{ t('settings.pushNotifications') }}
            </span>
            <span style="font-size: 0.85rem; color: var(--fg-secondary-color);">{{ t('settings.pushDesc') }}</span>
          </div>
          <KitBtn
            :variant="pwaStore.isPushSubscribed ? 'tonal' : 'outlined'"
            :color="pwaStore.isPushSubscribed ? 'success' : 'secondary'"
            style="flex-shrink: 0;"
            @click="handlePushToggle"
          >
            {{ pwaStore.isPushSubscribed ? t('settings.pushActive') : t('settings.pushEnable') }}
          </KitBtn>
        </div>
      </div>

      <!-- Настройки ИИ -->
      <h2 class="section-title">
        {{ t('settings.aiTitle') }}
      </h2>
      <div class="settings-card llm-card">
        <div class="llm-toggle">
          <KitCheckbox v-model="settingsStore.useCustomLlm" :label="t('settings.useCustomLlm')" />
        </div>

        <Transition name="fade">
          <div v-if="settingsStore.useCustomLlm" class="custom-llm-form">
            <p class="hint" v-html="t('settings.customLlmHint')" />
            <div class="form-row">
              <div class="form-group flex-2">
                <label>{{ t('settings.apiUrl') }}</label>
                <KitInput v-model="settingsStore.customLlmUrl" placeholder="http://localhost:11434/v1" />
              </div>

              <div class="form-group flex-1">
                <label>{{ t('settings.modelName') }}</label>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <KitSelect
                    v-if="availableModels.length > 0"
                    v-model="settingsStore.customLlmModel"
                    :options="availableModels"
                    style="flex: 1; min-width: 0;"
                  />
                  <KitInput
                    v-else
                    v-model="settingsStore.customLlmModel"
                    placeholder="llama3, qwen2..."
                    style="flex: 1; min-width: 0;"
                  />
                  <KitTooltip text="Загрузить список моделей" placement="top">
                    <KitBtn
                      variant="outlined"
                      color="secondary"
                      :icon="isFetchingModels ? 'mdi:loading' : 'mdi:refresh'"
                      :class="{ 'spin-animation': isFetchingModels }"
                      :disabled="isFetchingModels"
                      style="padding: 0; width: 38px; height: 38px; flex-shrink: 0;"
                      @click="fetchModels"
                    />
                  </KitTooltip>
                </div>
              </div>

              <div class="form-group flex-1">
                <label>{{ t('settings.apiKey') }}</label>
                <KitInput v-model="settingsStore.customLlmKey" placeholder="Любой ключ" />
              </div>
            </div>
          </div>
        </Transition>

        <KitCheckbox v-model="settingsStore.autoAnalyzePage" :label="t('settings.autoAnalyzePage')" />
      </div>

      <!-- Хранилище -->
      <h2 class="section-title">
        {{ t('settings.storageTitle') }}
      </h2>

      <div class="settings-card quota-card">
        <div class="quota-header">
          <div class="quota-title">
            <h3>{{ t('settings.browserStorage') }}</h3>
            <KitTooltip
              v-if="cacheStore.isPersisted"
              :text="t('settings.protectedHint')"
              placement="top"
            >
              <div class="badge-safe">
                <Icon icon="mdi:shield-check" /> {{ t('settings.protected') }}
              </div>
            </KitTooltip>
            <KitTooltip
              v-else
              :text="t('settings.notProtectedHint')"
              placement="top"
            >
              <div class="badge-warn">
                <Icon icon="mdi:shield-alert-outline" /> {{ t('settings.notProtected') }}
              </div>
            </KitTooltip>
          </div>
          <span class="quota-text">
            <KitSkeleton v-if="cacheStore.isLoading && !cacheStore.deviceStorage" width="120px" height="20px" color="var(--bg-tertiary-color)" />
            <template v-else>
              <b>{{ formatBytes(cacheStore.deviceStorage?.usage || 0) }}</b> / {{ formatBytes(cacheStore.deviceStorage?.quota || 0) }}
            </template>
          </span>
        </div>

        <div class="progress-bar-wrap">
          <KitSkeleton v-if="cacheStore.isLoading && !cacheStore.deviceStorage" width="100%" height="100%" color="var(--bg-tertiary-color)" />
          <div
            v-else
            class="progress-fill"
            :class="{ 'is-danger': storagePercent > 90, 'is-warning': storagePercent > 70 }"
            :style="{ width: `${storagePercent}%` }"
          />
        </div>
        <p class="quota-desc">
          {{ t('settings.quotaDesc').replace('{size}', formatBytes(cacheStore.stats?.totalSizeBytes || 0)) }}
        </p>
      </div>

      <div class="settings-card total-card">
        <div class="stat-item">
          <span class="label">{{ t('settings.dbUsage') }}</span>
          <KitSkeleton v-if="cacheStore.isLoading && !cacheStore.stats" width="120px" height="32px" color="var(--bg-tertiary-color)" />
          <span v-else class="value text-accent">{{ formatBytes(cacheStore.stats?.totalSizeBytes || 0) }}</span>
        </div>
        <div class="stat-item">
          <span class="label">{{ t('settings.dictWords') }}</span>
          <KitSkeleton v-if="cacheStore.isLoading && !cacheStore.stats" width="80px" height="32px" color="var(--bg-tertiary-color)" />
          <span v-else class="value">{{ cacheStore.stats?.totalDictionaryWords || 0 }}</span>
        </div>
      </div>

      <!-- Использование токенов -->
      <h2 class="section-title">
        {{ t('settings.tokenUsageTitle') }}
      </h2>
      <div class="settings-card tokens-card">
        <KitSkeleton v-if="isTokensLoading" width="100%" height="150px" color="var(--bg-tertiary-color)" />
        <template v-else-if="totalTokens.input > 0 || totalTokens.output > 0">
          <div class="total-tokens">
            <div class="stat-item">
              <span class="label">{{ t('settings.inputTokens') }}</span>
              <span class="value text-accent">{{ formatNumber(totalTokens.input) }}</span>
            </div>
            <div class="stat-item">
              <span class="label">{{ t('settings.outputTokens') }}</span>
              <span class="value">{{ formatNumber(totalTokens.output) }}</span>
            </div>
          </div>

          <div class="divider" />

          <div class="models-tokens-list">
            <div v-for="mod in tokensByModel" :key="mod.model" class="model-row-wrapper">
              <div class="model-row" :class="{ 'is-expanded': expandedModels[mod.model] }" @click="toggleModelExpand(mod.model)">
                <div class="model-name">
                  <Icon :icon="expandedModels[mod.model] ? 'mdi:chevron-down' : 'mdi:chevron-right'" class="expand-icon" />
                  <Icon icon="mdi:robot-outline" class="bot-icon" />
                  <span>{{ mod.model }}</span>
                </div>
                <div class="model-stats">
                  <span class="m-in" :title="t('settings.inputTokens')">
                    <Icon icon="mdi:arrow-down" class="token-icon" /> {{ formatNumber(mod.input) }}
                  </span>
                  <span class="m-out" :title="t('settings.outputTokens')">
                    <Icon icon="mdi:arrow-up" class="token-icon" /> {{ formatNumber(mod.output) }}
                  </span>
                </div>
              </div>

              <div v-show="expandedModels[mod.model]" class="model-details">
                <div v-for="act in mod.actions" :key="act.action" class="action-row">
                  <span class="action-name">{{ t(`settings.actions.${act.action}`) !== `settings.actions.${act.action}` ? t(`settings.actions.${act.action}`) : act.action }}</span>
                  <div class="action-stats">
                    <span class="m-in"><Icon icon="mdi:arrow-down" /> {{ formatNumber(act.input) }}</span>
                    <span class="m-out"><Icon icon="mdi:arrow-up" /> {{ formatNumber(act.output) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="empty-state">
          <Icon icon="mdi:database-off-outline" class="empty-icon" />
          <p>{{ t('settings.tokensNoData') }}</p>
        </div>
      </div>

      <h2 class="section-title">
        {{ t('settings.savedBooksData') }}
      </h2>
      <div class="books-list">
        <template v-if="cacheStore.isLoading && !cacheStore.stats">
          <div
            v-for="i in 2"
            :key="`mock-${i}`"
            class="settings-card book-cache-card"
          >
            <div class="book-card-header">
              <div class="title-section">
                <div class="icon-wrapper">
                  <Icon icon="mdi:book-open-variant" />
                </div>
                <KitSkeleton width="200px" height="24px" color="var(--bg-tertiary-color)" />
              </div>
              <KitBtn icon="mdi:delete-outline" variant="outlined" class="delete-btn" :disabled="true" />
            </div>

            <div class="book-card-body">
              <div class="stats-badges">
                <KitSkeleton width="100px" height="32px" border-radius="8px" color="var(--bg-tertiary-color)" />
                <KitSkeleton width="140px" height="32px" border-radius="8px" color="var(--bg-tertiary-color)" />
                <KitSkeleton width="160px" height="32px" border-radius="8px" color="var(--bg-tertiary-color)" />
              </div>

              <div class="cache-progress-section">
                <div class="progress-bar-wrap">
                  <KitSkeleton width="100%" height="100%" color="var(--bg-tertiary-color)" />
                </div>
                <div class="progress-footer">
                  <KitSkeleton width="180px" height="16px" color="var(--bg-tertiary-color)" />
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="cacheStore.stats">
          <div
            v-for="(book, id) in activeBookStats"
            :key="id"
            class="settings-card book-cache-card"
          >
            <div class="book-card-header">
              <div class="title-section">
                <div class="icon-wrapper">
                  <Icon icon="mdi:book-open-variant" />
                </div>
                <h3>{{ book.title }}</h3>
              </div>

              <KitBtn
                icon="mdi:delete-outline"
                variant="outlined"
                class="delete-btn"
                @click="cacheStore.clearBookCache(Number(id))"
              />
            </div>

            <div class="book-card-body">
              <div class="stats-badges">
                <div class="badge">
                  <Icon icon="mdi:database-outline" />
                  <span>{{ formatBytes(book.sizeBytes) }}</span>
                </div>
                <div class="badge">
                  <Icon icon="mdi:robot-outline" />
                  <span>{{ t('settings.cacheAiAnalyses') }} <b>{{ book.analysesCount }}</b></span>
                </div>
                <div class="badge">
                  <Icon icon="mdi:file-document-edit-outline" />
                  <span>{{ t('settings.cachePages') }} <b>{{ book.cachedPages.length }} / {{ book.totalPages }}</b></span>
                </div>
              </div>

              <div class="cache-progress-section">
                <div class="progress-bar-wrap">
                  <div
                    class="progress-fill"
                    :style="{ width: `${book.totalPages > 0 ? (book.cachedPages.length / book.totalPages) * 100 : 0}%` }"
                  />
                </div>
                <div class="progress-footer">
                  <span class="progress-text" v-html="t('settings.offlineAvailable').replace('{percent}', `<b>${book.totalPages > 0 ? Math.round((book.cachedPages.length / book.totalPages) * 100) : 0}</b>`)" />

                  <KitTooltip v-if="book.cachedPages.length > 0" :text="formatPagesList(book.cachedPages)" placement="top-end">
                    <span class="pages-list-hint">{{ t('settings.pageNumbers') }}</span>
                  </KitTooltip>
                </div>
              </div>
            </div>
          </div>

          <div v-if="Object.keys(activeBookStats).length === 0" class="empty-state">
            <Icon icon="mdi:folder-open-outline" class="empty-icon" />
            <p>{{ t('settings.noBooks') }}</p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.cache-manager-page {
  position: relative;
  z-index: 1;
  max-width: 900px;
  margin: 0 auto;
  padding: 32px;
  width: 100%;
  height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow-y: auto;

  @include media-down(md) {
    padding: 16px;
  }
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;

  .header-title {
    h1 {
      margin: 0 0 4px;
      font-size: 1.8rem;
    }
    p {
      margin: 0;
      color: var(--fg-secondary-color);
    }
  }
}

.section-title {
  margin-top: 32px;
  margin-bottom: 16px;
  font-size: 1.4rem;
}

.settings-card {
  background: var(--bg-secondary-color);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  margin-bottom: 16px;
}

.lang-card {
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;

    label {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--fg-secondary-color);
    }
  }
}

.llm-card {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .custom-llm-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px dashed var(--border-secondary-color);
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
    code {
      background: var(--bg-tertiary-color);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--fg-accent-color);
    }
  }

  .form-row {
    display: flex;
    gap: 16px;
    @include media-down(sm) {
      flex-direction: column;
    }
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;

    label {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--fg-secondary-color);
    }

    &.flex-2 {
      flex: 2;
    }
    &.flex-1 {
      flex: 1;
    }
  }
}

.quota-card {
  .quota-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    @include media-down(sm) {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .quota-title {
      display: flex;
      align-items: center;
      gap: 12px;

      h3 {
        margin: 0;
        font-size: 1.1rem;
        color: var(--fg-primary-color);
      }

      .badge-safe,
      .badge-warn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 99px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .badge-safe {
        background: rgba(var(--bg-success-color-rgb, 38, 157, 105), 0.2);
        color: var(--fg-success-color);
      }
      .badge-warn {
        background: rgba(var(--bg-warning-color-rgb, 225, 96, 50), 0.2);
        color: var(--fg-warning-color);
      }
    }

    .quota-text {
      font-size: 0.95rem;
      color: var(--fg-secondary-color);
      display: inline-flex;
      align-items: center;
      b {
        color: var(--fg-primary-color);
      }
    }
  }

  .progress-bar-wrap {
    width: 100%;
    height: 12px;
    background-color: var(--bg-primary-color);
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 12px;

    .progress-fill {
      height: 100%;
      background-color: var(--fg-accent-color);
      transition:
        width 0.5s ease-in-out,
        background-color 0.3s;

      &.is-warning {
        background-color: var(--fg-warning-color);
      }
      &.is-danger {
        background-color: var(--fg-error-color);
      }
    }
  }

  .quota-desc {
    margin: 0;
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
  }
}

.total-card,
.tokens-card {
  display: flex;
  gap: 48px;

  @include media-down(sm) {
    flex-direction: column;
    gap: 16px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .label {
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .value {
      font-size: 2rem;
      font-weight: 600;
      display: inline-flex;

      &.text-accent {
        color: var(--fg-accent-color);
      }
    }
  }
}

.tokens-card {
  flex-direction: column;
  gap: 24px;

  .total-tokens {
    display: flex;
    gap: 48px;

    @include media-down(sm) {
      gap: 24px;
    }
  }

  .divider {
    height: 1px;
    background: var(--border-secondary-color);
  }

  .models-tokens-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .model-row-wrapper {
    display: flex;
    flex-direction: column;
    background: var(--bg-tertiary-color);
    border-radius: 8px;
    border: 1px solid var(--border-secondary-color);
    overflow: hidden;

    .model-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      cursor: pointer;
      user-select: none;
      transition: background-color 0.2s;

      &:hover {
        background: var(--bg-hover-color);
      }

      &.is-expanded {
        border-bottom: 1px dashed var(--border-secondary-color);
        background: var(--bg-primary-color);
      }

      .model-name {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        color: var(--fg-primary-color);

        .expand-icon {
          font-size: 1.4rem;
          color: var(--fg-secondary-color);
        }

        .bot-icon {
          font-size: 1.2rem;
          color: var(--fg-accent-color);
        }
      }

      .model-stats {
        display: flex;
        gap: 16px;
        font-size: 0.9rem;
        font-variant-numeric: tabular-nums;
        font-weight: 500;

        .token-icon {
          font-size: 1rem;
          margin-right: 2px;
        }

        .m-in {
          color: var(--fg-accent-color);
          display: flex;
          align-items: center;
        }
        .m-out {
          color: var(--fg-secondary-color);
          display: flex;
          align-items: center;
        }
      }
    }

    .model-details {
      display: flex;
      flex-direction: column;
      background: var(--bg-primary-color);
      padding: 8px 16px 16px 16px;
      gap: 12px;

      .action-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.85rem;

        .action-name {
          color: var(--fg-primary-color);
          font-weight: 500;
          display: flex;
          align-items: center;

          &::before {
            content: '•';
            color: var(--fg-accent-color);
            margin-right: 8px;
            font-size: 1.2rem;
          }
        }

        .action-stats {
          display: flex;
          gap: 12px;
          color: var(--fg-secondary-color);
          font-variant-numeric: tabular-nums;

          span {
            display: flex;
            align-items: center;
            gap: 2px;
          }
        }
      }
    }
  }
}

.books-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.book-cache-card {
  background: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:hover {
    border-color: var(--border-accent-color);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
  }

  .book-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;

    .title-section {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-grow: 1;
      min-width: 0;

      .icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.15);
        color: var(--fg-accent-color);
        border-radius: 12px;
        font-size: 1.6rem;
        flex-shrink: 0;
      }

      h3 {
        margin: 0;
        font-size: 1.15rem;
        color: var(--fg-primary-color);
        font-weight: 600;
        line-height: 1.4;
        word-break: break-word;
      }
    }

    .delete-btn {
      color: var(--fg-error-color) !important;
      border-color: var(--border-error-color) !important;
      flex-shrink: 0;
      padding: 0.5rem;

      &:hover:not(:disabled) {
        background-color: var(--bg-error-color) !important;
        color: white !important;
      }
    }
  }

  .book-card-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .stats-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;

    .badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-secondary-color);
      border: 1px solid var(--border-secondary-color);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.9rem;
      color: var(--fg-secondary-color);

      svg {
        font-size: 1.2rem;
        color: var(--fg-primary-color);
      }

      b {
        color: var(--fg-primary-color);
        font-weight: 600;
      }
    }
  }

  .cache-progress-section {
    background: var(--bg-secondary-color);
    padding: 16px;
    border-radius: 12px;

    .progress-bar-wrap {
      width: 100%;
      height: 6px;
      background-color: var(--bg-tertiary-color);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 12px;

      .progress-fill {
        height: 100%;
        background-color: var(--fg-accent-color);
        border-radius: 3px;
        transition: width 0.3s ease;
      }
    }

    .progress-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;

      .progress-text {
        color: var(--fg-secondary-color);
        display: inline-flex;
        align-items: center;
        :deep(b) {
          color: var(--fg-primary-color);
          margin: 0 4px;
        }
      }

      .pages-list-hint {
        color: var(--fg-accent-color);
        cursor: help;
        font-weight: 500;
        text-decoration: underline;
        text-decoration-style: dashed;
        text-decoration-color: var(--fg-accent-color);
        text-underline-offset: 4px;
        padding-left: 12px;
      }
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px;
  color: var(--fg-secondary-color);
  border: 1px dashed var(--border-primary-color);
  border-radius: 16px;
  background-color: var(--bg-secondary-color);

  .empty-icon {
    font-size: 3rem;
    opacity: 0.5;
  }

  p {
    margin: 0;
    font-size: 1.1rem;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.spin-animation {
  :deep(svg) {
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
