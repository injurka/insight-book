<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { dbRpc, onSyncProgress } from '~/01.shared/lib/db.client'
import { useCacheStore } from '~/01.shared/store/cache.store'
import { KitBtn, KitDialog, KitSelect, KitSkeleton, KitTooltip } from '~/02.kit'
import { formatBytes } from '../../lib/formatters'

const { t } = useI18n()
const cacheStore = useCacheStore()

const isDownloading = ref(false)
const isModalOpen = ref(false)
const selectedLanguage = ref('ru')
const syncProgressState = ref({ stage: '', loaded: 0, total: 100 })

const languageOptions = [
  { value: 'ru', label: 'Русский (ru)' },
  { value: 'en', label: 'English (en)' },
  { value: 'zh', label: '中文 (zh)' },
]

const storagePercent = computed(() => {
  if (!cacheStore.deviceStorage || cacheStore.deviceStorage.quota === 0)
    return 0

  return Math.min(100, Math.round((cacheStore.deviceStorage.usage / cacheStore.deviceStorage.quota) * 100))
})

const unsubscribeSync = onSyncProgress((prog) => {
  syncProgressState.value = prog
  if (prog.loaded >= prog.total && prog.stage === 'Completed') {
    isDownloading.value = false
    cacheStore.loadStats()
  }
})

onUnmounted(() => {
  unsubscribeSync()
})

function openDownloadModal() {
  if (isDownloading.value)
    return
  isModalOpen.value = true
}

async function startDownloadLlmCache() {
  isModalOpen.value = false
  if (isDownloading.value)
    return
  isDownloading.value = true
  syncProgressState.value = { stage: 'Инициализация...', loaded: 0, total: 100 }
  try {
    const url = `/api/dictionary/llm-cache?lang=${selectedLanguage.value}`
    const token = localStorage.getItem('insight_token') || undefined
    await dbRpc.downloadAndAttachPublicDict(url, undefined, token)
  }
  catch (e) {
    console.error('Failed to download public LLM cache database:', e)
    isDownloading.value = false
  }
}
</script>

<template>
  <h2 class="section-title">
    {{ t('settings.storageTitle') }}
  </h2>

  <div class="settings-card quota-card">
    <div class="quota-header">
      <div class="quota-title">
        <h3>{{ t('settings.browserStorage') }}</h3>
        <KitTooltip v-if="cacheStore.isPersisted" :text="t('settings.protectedHint')" placement="top">
          <div class="badge-safe">
            <Icon icon="mdi:shield-check" /> {{ t('settings.protected') }}
          </div>
        </KitTooltip>
        <KitTooltip v-else :text="t('settings.notProtectedHint')" placement="top">
          <div class="badge-warn">
            <Icon icon="mdi:shield-alert-outline" /> {{ t('settings.notProtected') }}
          </div>
        </KitTooltip>
      </div>
      <span class="quota-text">
        <KitSkeleton
          v-if="cacheStore.isLoading && !cacheStore.deviceStorage"
          width="120px"
          height="20px"
          color="var(--bg-tertiary-color)"
        />
        <template v-else>
          <b>{{ formatBytes(cacheStore.deviceStorage?.usage || 0) }}</b> / {{ formatBytes(cacheStore.deviceStorage?.quota || 0) }}
        </template>
      </span>
    </div>

    <div class="progress-bar-wrap">
      <KitSkeleton
        v-if="cacheStore.isLoading && !cacheStore.deviceStorage"
        width="100%"
        height="100%"
        color="var(--bg-tertiary-color)"
      />
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
      <KitSkeleton
        v-if="cacheStore.isLoading && !cacheStore.stats"
        width="120px"
        height="32px"
        color="var(--bg-tertiary-color)"
      />
      <span v-else class="value text-accent">{{ formatBytes(cacheStore.stats?.totalSizeBytes || 0) }}</span>
    </div>
    <div class="stat-item">
      <span class="label">{{ t('settings.dictWords') }}</span>
      <KitSkeleton
        v-if="cacheStore.isLoading && !cacheStore.stats"
        width="80px"
        height="32px"
        color="var(--bg-tertiary-color)"
      />
      <span v-else class="value">{{ cacheStore.stats?.totalDictionaryWords || 0 }}</span>
    </div>
  </div>

  <div class="settings-card download-card">
    <div class="download-info">
      <h3>Скачать оффлайн LLM-кэш и словарь</h3>
      <p>Загрузка серверного LLM-кэша и публичного словаря по выбранному языку прямо в OPFS SQLite.</p>
    </div>
    <div v-if="isDownloading" class="download-progress">
      <div class="progress-label">
        <span>{{ syncProgressState.stage }}</span>
        <span>{{ syncProgressState.loaded }}%</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-fill" :style="{ width: `${syncProgressState.loaded}%` }" />
      </div>
    </div>
    <KitBtn
      v-else
      variant="solid"
      :disabled="isDownloading"
      @click="openDownloadModal"
    >
      Скачать оффлайн-базу
    </KitBtn>
  </div>

  <div v-if="cacheStore.stats?.languageStats && Object.keys(cacheStore.stats.languageStats).length > 0" class="settings-card languages-card">
    <h3>Скачанные базы</h3>
    <div class="languages-list">
      <div v-for="(stat, lang) in cacheStore.stats.languageStats" :key="lang" class="language-item">
        <div class="lang-info">
          <span class="lang-code">{{ lang.toUpperCase() }}</span>
          <div class="lang-stats">
            <span class="stat-badge"><Icon icon="mdi:translate" /> {{ stat.dictionaryWords }} слов</span>
            <span class="stat-badge"><Icon icon="mdi:brain" /> {{ stat.analysesCount }} разборов</span>
            <span class="stat-badge"><Icon icon="mdi:database" /> {{ formatBytes(stat.sizeBytes) }}</span>
          </div>
        </div>
        <KitBtn
          variant="outlined"
          color="error"
          class="delete-btn"
          @click="cacheStore.deleteLanguage(String(lang))"
        >
          <Icon icon="mdi:delete-outline" />
        </KitBtn>
      </div>
    </div>
  </div>

  <KitDialog
    v-model:visible="isModalOpen"
    title="Скачать оффлайн LLM-кэш"
    icon="mdi:database-outline"
    :max-width="480"
  >
    <div class="modal-body">
      <p class="modal-desc">
        Выберите язык изучаемого материала. База данных содержит подготовленный словарь, грамматический анализ и LLM-кэш предложений.
      </p>
      <div class="field-group">
        <label class="field-label">Язык словаря / кэша:</label>
        <KitSelect
          v-model="selectedLanguage"
          :options="languageOptions"
        />
      </div>
    </div>
    <template #footer>
      <KitBtn variant="outlined" @click="isModalOpen = false">
        Отмена
      </KitBtn>
      <KitBtn variant="solid" @click="startDownloadLlmCache">
        <Icon icon="mdi:cloud-download" /> Скачать
      </KitBtn>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
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
.total-card {
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
.download-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  @include media-down(sm) {
    flex-direction: column;
    align-items: flex-start;
  }
  .download-info {
    h3 {
      margin: 0 0 6px 0;
      font-size: 1.1rem;
    }
    p {
      margin: 0;
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
    }
  }
  .download-progress {
    width: 100%;
    max-width: 300px;
    .progress-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      margin-bottom: 6px;
    }
    .progress-bar-wrap {
      width: 100%;
      height: 8px;
      background: var(--bg-primary-color);
      border-radius: 4px;
      overflow: hidden;
      .progress-fill {
        height: 100%;
        background: var(--fg-accent-color);
        transition: width 0.3s ease;
      }
    }
  }
}
.modal-body {
  padding: 8px 0;
  .modal-desc {
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    margin-bottom: 16px;
  }
  .field-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    .field-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }
  }
}

.languages-card {
  h3 {
    margin: 0 0 16px 0;
    font-size: 1.1rem;
  }
  .languages-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .language-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: var(--bg-tertiary-color);
    border-radius: 8px;
    .lang-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .lang-code {
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--fg-accent-color);
      text-transform: uppercase;
      background: var(--bg-primary-color);
      padding: 4px 8px;
      border-radius: 4px;
    }
    .lang-stats {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .stat-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
    }
    .delete-btn {
      min-width: 36px;
      width: 36px;
      height: 36px;
      padding: 0;
    }
  }
}
</style>
