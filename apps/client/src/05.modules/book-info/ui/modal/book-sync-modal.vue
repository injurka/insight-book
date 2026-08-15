<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppWakeLock } from '~/01.shared/composables/use-app-wake-lock'
import { useToast } from '~/01.shared/composables/use-toast'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useNetworkStore } from '~/01.shared/store/network.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'
import { useLibraryStore } from '~/05.modules/library/store/library.store'
import { useBookSyncSections } from '../../composables/use-book-sync-sections'
import { formatNumber } from '../../lib/formatters'
import BookSyncCacheOverview from './book-sync-cache-overview.vue'

interface Props {
  bookId: number
}

const props = defineProps<Props>()
const visible = defineModel<boolean>('visible', { required: true })
const libraryStore = useLibraryStore()
const networkStore = useNetworkStore()
const authStore = useAuthStore()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()

const currentBook = computed(() =>
  libraryStore.currentBookInfo?.id === props.bookId
    ? libraryStore.currentBookInfo
    : libraryStore.books.find(b => b.id === props.bookId))

const options = ref({
  cachePages: true,
  analyzeSentences: false,
  analyzeWords: false,
  ttsSentences: false,
  ttsWords: false,
})

const isIdle = computed(() => libraryStore.syncState === 'idle')
const isRunning = computed(() => libraryStore.syncState === 'running')
const isFinished = computed(() => libraryStore.syncState === 'finished')
const hasError = computed(() => libraryStore.syncState === 'error')

const hasTokenLimitError = computed(() =>
  libraryStore.syncErrorCode === 'TOKEN_LIMIT_EXCEEDED')

const isAccountTokenLimitExceeded = computed(() => {
  if (hasTokenLimitError.value)
    return true
  const user = authStore.user
  if (!user || user.tokenLimit === null || user.tokenLimit === undefined)
    return false

  return (user.usedTokens ?? 0) >= user.tokenLimit
})

const canStart = computed(() => {
  const opts = options.value

  return (
    opts.cachePages
    || opts.ttsSentences
    || opts.ttsWords
    || (!isAccountTokenLimitExceeded.value && (opts.analyzeSentences || opts.analyzeWords))
  )
})

const { sections } = useBookSyncSections(isFinished)

const overallPercent = computed(() => {
  if (isFinished.value)
    return 100

  const p = libraryStore.syncProgress

  if (p.pagesTotal <= 0)
    return 0

  return Math.min(100, Math.round((p.pagesDone / p.pagesTotal) * 100))
})

const cachedSummaryItems = computed(() =>
  sections.value.filter(s => s.fromCache > 0 && s.key !== 'pages'))

useAppWakeLock(isRunning)

const syncStateIcon = computed(() => {
  if (hasTokenLimitError.value)
    return 'mdi:alert-octagon-outline'
  if (hasError.value)
    return 'mdi:alert-circle-outline'
  if (isFinished.value)
    return 'mdi:check-circle-outline'

  return 'mdi:loading'
})

const syncStateClass = computed(() => {
  if (hasTokenLimitError.value)
    return 'is-limit-error'
  if (hasError.value)
    return 'is-error'
  if (isFinished.value)
    return 'is-success'

  return 'is-running'
})

function toggleSentences() {
  if (isAccountTokenLimitExceeded.value) {
    toast.warn(t('bookInfo.tokenLimitSetupWarning'))

    return
  }

  options.value.analyzeSentences = !options.value.analyzeSentences
}

function toggleWords() {
  if (isAccountTokenLimitExceeded.value) {
    toast.warn(t('bookInfo.tokenLimitSetupWarning'))

    return
  }

  options.value.analyzeWords = !options.value.analyzeWords
}

function resetToSetup() {
  libraryStore.syncState = 'idle'
  libraryStore.syncErrorCode = null
  options.value.analyzeSentences = false
  options.value.analyzeWords = false
  options.value.cachePages = true
}

function goToLimits() {
  visible.value = false
  router.push('/limits')
}

function start() {
  if (networkStore.effectiveOffline) {
    toast.warn(t('network.needOnline'))

    return
  }

  libraryStore.startWholeBookSync(props.bookId, options.value)
}

function cancel() {
  libraryStore.cancelSync()
}

function close() {
  if (isRunning.value)
    return
  visible.value = false
}

watch(visible, (val) => {
  if (val && libraryStore.syncState !== 'running') {
    if (libraryStore.syncState !== 'error') {
      libraryStore.syncState = 'idle'
      options.value = { ...libraryStore.syncOptions }
    }

    if (isAccountTokenLimitExceeded.value) {
      options.value.analyzeSentences = false
      options.value.analyzeWords = false
    }
  }
})
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="t('bookInfo.cacheAnalysis')"
    icon="mdi:cloud-download-outline"
    :persistent="isRunning"
    :max-width="500"
  >
    <div v-if="isIdle" class="sync-setup">
      <div v-if="isAccountTokenLimitExceeded" class="token-limit-setup-alert">
        <Icon icon="mdi:alert-octagon-outline" class="alert-icon" />
        <div class="alert-content">
          <span class="alert-title">{{ t('bookInfo.tokenLimitTitle') }}</span>
          <span class="alert-desc">{{ t('bookInfo.tokenLimitSetupWarning') }}</span>
        </div>
        <KitBtn
          size="sm"
          variant="text"
          color="primary"
          class="alert-action"
          @click="goToLimits"
        >
          {{ t('bookInfo.viewLimits') }}
        </KitBtn>
      </div>

      <div class="setup-header">
        <Icon icon="mdi:wifi-off" class="setup-icon" />
        <p>{{ t('bookInfo.syncSetupHint') }}</p>
      </div>

      <div class="sync-options">
        <div class="sync-option" :class="{ 'is-active': options.cachePages }" @click="options.cachePages = !options.cachePages">
          <div class="option-content">
            <Icon icon="mdi:file-document-multiple-outline" class="option-icon" />
            <div class="option-texts">
              <span class="option-title">{{ t('bookInfo.cachePages') }}</span>
              <span class="option-desc">{{ t('bookInfo.cachePagesDesc') }}</span>
            </div>
          </div>
          <KitCheckbox :model-value="options.cachePages" style="pointer-events: none;" />
        </div>

        <!-- Группа анализа текста -->
        <div class="sync-option-group">
          <div
            class="sync-option-half"
            :class="{
              'is-active': options.analyzeSentences && !isAccountTokenLimitExceeded,
              'is-disabled': isAccountTokenLimitExceeded,
            }"
            @click="toggleSentences"
          >
            <div class="option-content">
              <Icon icon="mdi:brain" class="option-icon" />
              <div class="option-texts">
                <span class="option-title">{{ t('bookInfo.deepAnalysis') }}</span>
                <span v-if="isAccountTokenLimitExceeded" class="option-limit-chip">
                  {{ t('bookInfo.tokenLimitBadge') }}
                </span>
              </div>
            </div>
            <KitCheckbox
              :model-value="options.analyzeSentences && !isAccountTokenLimitExceeded"
              :disabled="isAccountTokenLimitExceeded"
              style="pointer-events: none;"
            />
          </div>

          <div
            class="sync-option-half"
            :class="{
              'is-active': options.analyzeWords && !isAccountTokenLimitExceeded,
              'is-disabled': isAccountTokenLimitExceeded,
            }"
            @click="toggleWords"
          >
            <div class="option-content">
              <Icon icon="mdi:format-text" class="option-icon" />
              <div class="option-texts">
                <span class="option-title">{{ t('bookInfo.analyzeWords') }}</span>
                <span v-if="isAccountTokenLimitExceeded" class="option-limit-chip">
                  {{ t('bookInfo.tokenLimitBadge') }}
                </span>
              </div>
            </div>
            <KitCheckbox
              :model-value="options.analyzeWords && !isAccountTokenLimitExceeded"
              :disabled="isAccountTokenLimitExceeded"
              style="pointer-events: none;"
            />
          </div>
        </div>

        <!-- Группа TTS -->
        <div class="sync-option-group">
          <div class="sync-option-half" :class="{ 'is-active': options.ttsSentences }" @click="options.ttsSentences = !options.ttsSentences">
            <div class="option-content">
              <Icon icon="mdi:headphones" class="option-icon" />
              <div class="option-texts">
                <span class="option-title">{{ t('bookInfo.cacheTtsSentences') }}</span>
              </div>
            </div>
            <KitCheckbox :model-value="options.ttsSentences" style="pointer-events: none;" />
          </div>

          <div class="sync-option-half" :class="{ 'is-active': options.ttsWords }" @click="options.ttsWords = !options.ttsWords">
            <div class="option-content">
              <Icon icon="mdi:headphones" class="option-icon" />
              <div class="option-texts">
                <span class="option-title">{{ t('bookInfo.cacheTtsWords') }}</span>
              </div>
            </div>
            <KitCheckbox :model-value="options.ttsWords" style="pointer-events: none;" />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="sync-progress-view">
      <div class="progress-status-header" :class="syncStateClass">
        <Icon :icon="syncStateIcon" class="status-icon" :class="{ 'spin-animation': isRunning }" />
        <div class="task-block">
          <p class="current-task">
            {{ libraryStore.syncProgress.currentTask }}
          </p>
          <div v-if="!hasError" class="overall-progress">
            <span class="overall-label">{{ t('bookInfo.overallProgress') }}: {{ overallPercent }}%</span>
            <div class="progress-bar overall-bar">
              <div class="progress-fill" :style="{ width: `${overallPercent}%` }" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasTokenLimitError" class="token-limit-banner">
        <div class="banner-header">
          <Icon icon="mdi:alert-octagon-outline" class="banner-icon" />
          <div class="banner-title-group">
            <span class="banner-title">{{ t('bookInfo.tokenLimitTitle') }}</span>
            <span class="banner-desc">{{ t('bookInfo.tokenLimitSyncError') }}</span>
          </div>
        </div>
        <div class="banner-actions">
          <KitBtn size="sm" variant="tonal" @click="resetToSetup">
            <Icon icon="mdi:cog-outline" />
            {{ t('bookInfo.changeSyncOptions') }}
          </KitBtn>
          <KitBtn
            size="sm"
            variant="outlined"
            color="primary"
            @click="goToLimits"
          >
            <Icon icon="mdi:lightning-bolt" />
            {{ t('bookInfo.viewLimits') }}
          </KitBtn>
        </div>
      </div>

      <BookSyncCacheOverview
        :book="currentBook"
        :preloaded-count="libraryStore.syncProgress.totalPreloadedCache"
        :tts-from-cache="libraryStore.syncProgress.ttsFromCache"
      />

      <div class="progress-section-header">
        <Icon icon="mdi:progress-clock" class="header-icon" />
        <span>{{ t('bookInfo.pageByPageProgress') }}</span>
      </div>

      <div class="progress-bars-container">
        <div
          v-for="section in sections"
          :key="section.key"
          class="progress-section"
          :class="`is-${section.status}`"
        >
          <div class="progress-info">
            <div class="label-group">
              <span v-if="section.fromCache > 0" class="cache-badge">
                <Icon icon="mdi:database-check-outline" />
                {{ t('bookInfo.fromCache') }}: {{ section.fromCache }}
              </span>
              <span class="label">
                <Icon :icon="section.icon" />
                <span class="label-text">{{ section.label }}</span>
              </span>
            </div>
            <span class="value">
              <template v-if="section.key === 'pages' || isFinished">
                <b>{{ formatNumber(section.done) }}</b> / {{ formatNumber(section.total) }}
                <span class="percent">· {{ section.percent }}%</span>
              </template>
              <template v-else-if="section.estimatedTotal && section.estimatedTotal > section.done">
                <b>{{ formatNumber(section.done) }}</b> / ~{{ formatNumber(section.estimatedTotal) }}
                <span class="percent">· {{ section.percent }}%</span>
              </template>
              <template v-else>
                <b>{{ formatNumber(section.done) }}</b>
                <span class="percent">· {{ section.percent }}%</span>
              </template>
              <Icon
                v-if="section.status === 'done'"
                icon="mdi:check-circle"
                class="section-status done-icon"
              />
              <Icon
                v-else-if="section.status === 'active'"
                icon="mdi:loading"
                class="section-status spin-animation"
              />
            </span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :class="section.fillClass"
              :style="{ width: `${section.percent}%` }"
            />
          </div>
        </div>
      </div>

      <div v-if="isFinished && cachedSummaryItems.length > 0" class="sync-summary">
        <Icon icon="mdi:database-check-outline" class="summary-icon" />
        <div class="summary-text">
          <span>{{ t('bookInfo.cacheSummaryHint') }}</span>
          <div class="summary-items">
            <span v-for="item in cachedSummaryItems" :key="item.key" class="summary-item">
              {{ item.label }}: <b>{{ item.fromCache }}</b>
            </span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <template v-if="isIdle">
        <KitBtn variant="tonal" @click="close">
          {{ t('dictionary.cancel') }}
        </KitBtn>
        <KitBtn
          color="primary"
          :disabled="!canStart"
          @click="start"
        >
          {{ t('dictionary.start') }}
        </KitBtn>
      </template>

      <template v-else-if="isRunning">
        <KitBtn
          color="error"
          variant="outlined"
          @click="cancel"
        >
          {{ t('bookInfo.stop') }}
        </KitBtn>
      </template>

      <template v-else>
        <KitBtn color="primary" @click="close">
          {{ t('dictWord.close') }}
        </KitBtn>
      </template>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
.sync-setup {
  display: flex;
  flex-direction: column;
  gap: 20px;

  .token-limit-setup-alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: color-mix(in srgb, var(--fg-warning-color) 8%, var(--bg-secondary-color));
    border: 1px solid color-mix(in srgb, var(--fg-warning-color) 35%, transparent);
    border-radius: 10px;
    padding: 10px 12px;

    .alert-icon {
      font-size: 1.3rem;
      color: var(--fg-warning-color);
      flex-shrink: 0;
      margin-top: 1px;
    }

    .alert-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;

      .alert-title {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--fg-primary-color);
      }

      .alert-desc {
        font-size: 0.78rem;
        color: var(--fg-secondary-color);
        line-height: 1.3;
      }
    }

    .alert-action {
      flex-shrink: 0;
      align-self: center;
      font-size: 0.8rem;
    }
  }

  .setup-header {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.1);
    padding: 16px;
    border-radius: 12px;

    .setup-icon {
      font-size: 2rem;
      color: var(--fg-accent-color);
    }

    p {
      margin: 0;
      font-size: 0.95rem;
      color: var(--fg-primary-color);
      line-height: 1.4;
    }
  }

  .sync-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sync-option-group {
    display: flex;
    gap: 12px;
    @include media-down(sm) {
      flex-direction: column;
    }
  }

  .sync-option-half {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--border-primary-color);
    }

    &.is-active {
      border-color: var(--fg-accent-color);
      background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.05);

      .option-icon {
        color: var(--fg-accent-color);
      }
    }

    &.is-disabled {
      opacity: 0.6;
      cursor: not-allowed;
      border-color: var(--border-secondary-color) !important;
      background: var(--bg-secondary-color) !important;

      .option-icon {
        color: var(--fg-secondary-color) !important;
      }
    }

    .option-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .option-icon {
      font-size: 1.6rem;
      color: var(--fg-secondary-color);
      transition: color 0.2s ease;
    }

    .option-texts {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .option-title {
        font-weight: 500;
        font-size: 0.9rem;
        color: var(--fg-primary-color);
      }

      .option-limit-chip {
        display: inline-flex;
        font-size: 0.68rem;
        font-weight: 600;
        color: var(--fg-warning-color);
        background: color-mix(in srgb, var(--fg-warning-color) 12%, transparent);
        border-radius: 4px;
        padding: 1px 5px;
        width: fit-content;
      }
    }
  }

  .sync-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--border-primary-color);
    }

    &.is-active {
      border-color: var(--fg-accent-color);
      background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.05);
    }

    .option-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .option-icon {
      font-size: 1.8rem;
      color: var(--fg-secondary-color);
      transition: color 0.2s ease;
    }

    &.is-active .option-icon {
      color: var(--fg-accent-color);
    }

    .option-texts {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .option-title {
        font-weight: 600;
        font-size: 1rem;
        color: var(--fg-primary-color);
      }

      .option-desc {
        font-size: 0.85rem;
        color: var(--fg-secondary-color);
      }
    }
  }
}

.sync-progress-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 16px 0;

  .progress-status-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;

    .status-icon {
      font-size: 3rem;
      color: var(--fg-accent-color);

      &.spin-animation {
        animation: spin 1.5s linear infinite;
      }
    }

    &.is-success .status-icon {
      color: var(--fg-success-color);
    }

    &.is-error .status-icon {
      color: var(--fg-error-color);
    }

    &.is-limit-error .status-icon {
      color: var(--fg-warning-color);
    }

    .task-block {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;
    }

    .current-task {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      font-variant-numeric: tabular-nums;
    }

    .overall-progress {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .overall-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--fg-secondary-color);
        font-variant-numeric: tabular-nums;
      }

      .overall-bar {
        height: 6px;
      }
    }
  }

  .token-limit-banner {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: color-mix(in srgb, var(--fg-warning-color) 10%, var(--bg-secondary-color));
    border: 1px solid color-mix(in srgb, var(--fg-warning-color) 40%, transparent);
    border-radius: 12px;
    padding: 14px 16px;

    .banner-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;

      .banner-icon {
        font-size: 1.8rem;
        color: var(--fg-warning-color);
        flex-shrink: 0;
        margin-top: 2px;
      }

      .banner-title-group {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .banner-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--fg-primary-color);
        }

        .banner-desc {
          font-size: 0.84rem;
          color: var(--fg-secondary-color);
          line-height: 1.4;
        }
      }
    }

    .banner-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding-left: 40px;

      @include media-down(sm) {
        padding-left: 0;
      }
    }
  }

  .progress-section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    margin-bottom: -6px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--fg-secondary-color);

    .header-icon {
      font-size: 0.95rem;
    }
  }

  .progress-bars-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    background: var(--bg-secondary-color);
    padding: 20px;
    border-radius: 12px;
    border: 1px solid var(--border-secondary-color);
  }

  .progress-section {
    transition: opacity 0.3s ease;

    &.is-pending {
      opacity: 0.45;
    }

    &.is-active {
      .progress-fill {
        animation: progress-stripes 1s linear infinite;
        background-image: linear-gradient(
          45deg,
          rgba(255, 255, 255, 0.18) 25%,
          transparent 25%,
          transparent 50%,
          rgba(255, 255, 255, 0.18) 50%,
          rgba(255, 255, 255, 0.18) 75%,
          transparent 75%,
          transparent
        );
        background-size: 14px 14px;
      }
    }

    &.is-done {
      .progress-info .label {
        color: var(--fg-success-color);
      }

      .progress-fill {
        background-color: var(--fg-success-color);
      }
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 8px;
      font-size: 0.95rem;
      font-weight: 500;
      gap: 8px;
      min-width: 0;

      .label-group {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
        min-width: 0;
        flex: 1;

        .label {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--fg-primary-color);
          min-width: 0;

          svg {
            color: var(--fg-secondary-color);
            font-size: 1.1rem;
            flex-shrink: 0;
          }

          .label-text {
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }

        .cache-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 1px 7px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--fg-success-color);
          background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.08);
          border: 1px solid color-mix(in srgb, var(--fg-success-color) 35%, transparent);
          white-space: nowrap;
          flex-shrink: 0;

          svg {
            font-size: 0.85rem;
            color: var(--fg-success-color);
          }
        }
      }

      .value {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--fg-secondary-color);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        font-size: 0.88rem;
        flex-shrink: 0;
        margin-left: auto;
        align-self: flex-end;

        .percent {
          font-size: 0.82rem;
        }

        .section-status {
          font-size: 1.1rem;

          &.done-icon {
            color: var(--fg-success-color);
          }
        }
      }
    }

    .progress-bar {
      height: 8px;
      background-color: var(--bg-tertiary-color);
      border-radius: 4px;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;

        &.pages-fill {
          background-color: var(--fg-accent-color);
        }

        &.sentences-fill {
          background-color: var(--fg-accent-color);
        }

        &.words-fill {
          background-color: var(--fg-accent-color);
        }

        &.tts-fill {
          background-color: var(--fg-info-color);
        }
      }
    }
  }

  .sync-summary {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.08);
    border: 1px solid color-mix(in srgb, var(--fg-success-color) 30%, transparent);
    border-radius: 12px;
    padding: 14px 16px;

    .summary-icon {
      font-size: 1.6rem;
      color: var(--fg-success-color);
      flex-shrink: 0;
    }

    .summary-text {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.9rem;
      color: var(--fg-primary-color);

      .summary-items {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .summary-item {
          font-size: 0.85rem;
          color: var(--fg-secondary-color);
          background: var(--bg-tertiary-color);
          border-radius: 8px;
          padding: 3px 10px;

          b {
            color: var(--fg-success-color);
            font-variant-numeric: tabular-nums;
          }
        }
      }
    }
  }
}

@keyframes progress-stripes {
  from {
    background-position: 0 0;
  }
  to {
    background-position: 14px 0;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s,
    transform 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
