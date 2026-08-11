<script setup lang="ts">
import type { GeneratedWordExamples } from '~/01.shared/types/models'
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { Icon } from '@iconify/vue'
import { useResizeObserver } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useRepos } from '~/00.plugins/di'
import { useToast } from '~/01.shared/composables/use-toast'
import { useTts } from '~/01.shared/composables/use-tts'
import { POS_TAGS_MAP } from '~/01.shared/constants/pos-tags'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store.ts'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitSkeleton } from '~/02.kit/atoms/kit-skeleton/ui'
import { KitDropdown } from '~/02.kit/molecules/kit-dropdown/ui'
import { KitTooltip } from '~/02.kit/molecules/kit-tooltip/ui'

import { useLibraryStore } from '~/05.modules/library/store/library.store'
import { useReaderStore } from '~/05.modules/reader/store/reader.store'

const repos = useRepos()

const analysisStore = useAnalysisStore()
const authStore = useAuthStore()
const { speak, stop, isPlaying, isLoading } = useTts()
const toast = useToast()
const { t } = useI18n()

const AiExamplesModal = lazyComponent(() => import('../modal/ai-examples-modal.vue'))
const LlmChatModal = lazyComponent(() => import('~/04.features/llm-chat/ui/llm-chat-modal.vue'))

provide('kit-dialog-z-index', ref(1300))

const popoverRef = ref<HTMLElement | null>(null)

const referenceEl = computed(() => analysisStore.wordPopover?.target || null)

const { x, y, strategy } = useFloating(referenceEl, popoverRef, {
  placement: 'bottom',
  strategy: 'fixed',
  middleware: [
    offset(8),
    flip({ padding: 10 }),
    shift({ padding: 10 }),
  ],
  whileElementsMounted: autoUpdate,
})

const popoverPos = computed(() => {
  if (!analysisStore.wordPopover || x.value == null || y.value == null)
    return { top: '-9999px', left: '-9999px', visibility: 'hidden' as const }

  return {
    position: strategy.value,
    top: `${y.value}px`,
    left: `${x.value}px`,
    visibility: 'visible' as const,
  }
})

const isAiModalOpen = ref(false)
const isChatModalOpen = ref(false)
const chatWord = ref('')
const isAiLoading = ref(false)
const aiData = ref<GeneratedWordExamples | null>(null)

const currentLanguage = computed(() => {
  const readerStore = useReaderStore()
  const libraryStore = useLibraryStore()

  return (readerStore.currentBook || libraryStore.currentBookInfo)?.language || 'en'
})

const headerText = computed(() => {
  if (!analysisStore.wordPopover)
    return ''

  return analysisStore.wordPopover.transcription
})

const innerRef = ref<HTMLElement | null>(null)
const contentHeight = ref<string>('auto')

useResizeObserver(innerRef, (entries) => {
  const target = entries[0].target as HTMLElement
  contentHeight.value = `${target.offsetHeight}px`
})

function getPosClass(pos: string) {
  if (!pos)
    return 'pos-default'
  const posLower = pos.toLowerCase()
  if (posLower.startsWith('n'))
    return 'pos-noun'
  if (posLower.startsWith('v'))
    return 'pos-verb'
  if (posLower.startsWith('a') || posLower.startsWith('d'))
    return 'pos-adj'
  if (posLower.startsWith('r'))
    return 'pos-pronoun'

  return 'pos-default'
}

watch(() => analysisStore.wordPopover, (val) => {
  if (!val)
    stop()
})

function openSaveDialog() {
  if (!analysisStore.wordPopover)
    return
  analysisStore.openAddEditWordModal(analysisStore.wordPopover)
  analysisStore.closePopover()
}

function playWordTTS() {
  if (analysisStore.wordPopover) {
    if (isPlaying.value || isLoading.value)
      stop()
    else speak(analysisStore.wordPopover.word)
  }
}

async function fetchAiExamples() {
  if (!analysisStore.wordPopover?.word)
    return
  const word = analysisStore.wordPopover.word

  analysisStore.closePopover()

  isAiModalOpen.value = true
  isAiLoading.value = true
  aiData.value = null

  try {
    aiData.value = await repos.dictionary.generateExamples(word, currentLanguage.value)
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : t('dictionary.errorExamples'))
    isAiModalOpen.value = false
  }
  finally {
    isAiLoading.value = false
  }
}

function openFreeQuestion() {
  if (!analysisStore.wordPopover?.word)
    return
  chatWord.value = analysisStore.wordPopover.word
  analysisStore.closePopover()
  isChatModalOpen.value = true
}

function closePopover(event?: MouseEvent) {
  const target = event?.target as HTMLElement | null
  if (target?.closest('.kit-dialog') || target?.closest('.word-popover'))
    return
  analysisStore.closePopover()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && analysisStore.wordPopover) {
    analysisStore.closePopover()
  }
}

onMounted(() => {
  document.addEventListener('click', closePopover)
  document.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', closePopover)
  document.removeEventListener('keydown', handleKeydown)
  stop()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="analysisStore.wordPopover"
        ref="popoverRef"
        class="word-popover"
        :style="popoverPos"
        @click.stop
      >
        <div class="transcription-header">
          <span class="header-text">{{ headerText }}</span>
          <button class="close-btn" :aria-label="t('kit.dialog.close')" @click.stop="analysisStore.closePopover()">
            <Icon width="18" height="18" icon="mdi:chevron-down" />
          </button>
        </div>

        <div class="popover-content">
          <div class="height-animator" :style="{ height: contentHeight, transition: 'height 0.25s ease', overflow: 'hidden' }">
            <div ref="innerRef" class="popover-inner-grid">
              <Transition name="content-fade">
                <div v-if="analysisStore.wordPopover.isLoading && !analysisStore.wordPopover.translation" key="loader" class="ai-loader">
                  <KitSkeleton width="95%" height="16px" />
                  <KitSkeleton width="75%" height="16px" />
                  <KitSkeleton width="90%" height="16px" />
                </div>
                <div v-else key="content" class="popover-body">
                  <div class="translation" v-html="analysisStore.wordPopover.translation" />
                  <template v-if="analysisStore.wordPopover.aiData">
                    <div v-if="analysisStore.wordPopover.aiData.grammarRules?.length" class="ai-section">
                      <div class="ai-subtitle">
                        {{ t('analysis.grammarColon') }}
                      </div>
                      <div v-for="(rule, idx) in analysisStore.wordPopover.aiData.grammarRules" :key="idx" class="ai-rule">
                        <b>{{ rule.pattern }}</b> — {{ rule.explanation }}
                      </div>
                    </div>
                    <div v-if="analysisStore.wordPopover.aiData.vocabulary?.length" class="ai-section">
                      <div class="ai-subtitle">
                        {{ t('analysis.vocabularyColon') }}
                      </div>
                      <template v-for="(vocab, idx) in analysisStore.wordPopover.aiData.vocabulary" :key="idx">
                        <div v-if="vocab && vocab.word" class="ai-vocab">
                          <b>{{ vocab.word }}</b> <template v-if="vocab.transcription">
                            ({{ vocab.transcription }})
                          </template> — {{ vocab.meaning }}
                        </div>
                      </template>
                    </div>
                  </template>
                </div>
              </Transition>
            </div>
          </div>
        </div>

        <div class="popover-footer">
          <div v-if="analysisStore.wordPopover.pos" class="pos-badge" :class="getPosClass(analysisStore.wordPopover.pos)">
            {{ POS_TAGS_MAP[analysisStore.wordPopover.pos] ? t(POS_TAGS_MAP[analysisStore.wordPopover.pos]) : analysisStore.wordPopover.pos }}
          </div>
          <div v-else class="pos-badge-placeholder" />

          <div class="popover-actions">
            <KitTooltip :text="t('analysis.voice')" placement="bottom">
              <KitBtn
                :icon="isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium'"
                size="xs"
                variant="text"
                :loading="isLoading"
                :class="{ 'pulse-animation': isPlaying }"
                @click.stop="playWordTTS"
              />
            </KitTooltip>

            <KitDropdown placement="top" width="240px">
              <template #activator="{ props: { isOpen, toggle } }">
                <KitTooltip :text="t('analysis.detailedWithAi')" placement="bottom">
                  <KitBtn
                    icon="mdi:text-box-search-outline"
                    size="xs"
                    variant="text"
                    :class="{ 'is-active-ai': isOpen }"
                    @click.stop="toggle"
                  />
                </KitTooltip>
              </template>

              <div class="dropdown-menu-list">
                <button class="dropdown-item" @click.stop="fetchAiExamples">
                  <Icon icon="mdi:text-box-search-outline" /> {{ t('analysis.aiContextAndExamples') }}
                </button>
                <button class="dropdown-item" @click.stop="openFreeQuestion">
                  <Icon icon="mdi:robot-outline" /> {{ t('dictionary.aiFreeQuestion') }}
                </button>
              </div>
            </KitDropdown>

            <KitTooltip v-if="authStore.user" :text="analysisStore.wordPopover.isSaved ? t('analysis.editCard') : t('analysis.saveToDict')" placement="bottom-end">
              <KitBtn
                :icon="analysisStore.wordPopover.isSaved ? 'mdi:star' : 'mdi:star-outline'"
                size="xs"
                variant="text"
                :class="{ 'is-saved-star': analysisStore.wordPopover.isSaved }"
                @click.stop="openSaveDialog"
              />
            </KitTooltip>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <AiExamplesModal v-model:visible="isAiModalOpen" :loading="isAiLoading" :data="aiData" />
  <LlmChatModal
    v-if="isChatModalOpen"
    v-model:visible="isChatModalOpen"
    :word="chatWord"
    :language="currentLanguage"
  />
</template>

<style lang="scss" scoped>
.word-popover {
  position: fixed;
  z-index: var(--z-popover, 1300);
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  width: 90vw;
  max-width: 450px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 70vh;
  min-height: 150px;
}

.transcription-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px 8px 16px;
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 44px;

  .header-text {
    font-weight: 600;
    font-size: 1.15rem;
    color: var(--fg-accent-color);
    text-align: center;
  }

  .close-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--fg-secondary-color);
    cursor: pointer;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition:
      background-color 0.2s,
      color 0.2s;

    &:hover {
      background-color: var(--bg-hover-color);
      color: var(--fg-primary-color);
    }

    svg {
      font-size: 1.4rem;
    }
  }
}

.popover-content {
  display: block;
  overflow-y: auto;
  flex: 1;

  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.height-animator {
  width: 100%;
}

.popover-inner-grid {
  display: grid;
  grid-template-columns: 100%;
}

.popover-inner-grid > * {
  grid-column: 1;
  grid-row: 1;
}

.popover-body {
  padding: 8px 16px;
  position: relative;
}

.ai-loader {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.translation {
  font-size: 0.95rem;
  color: var(--fg-primary-color);
  line-height: 1.45;
  text-align: left;
  margin-bottom: 8px;
  word-break: break-word;
  white-space: pre-wrap;
  display: flex;
  flex-direction: column;
}

.ai-section {
  margin-top: 12px;
  border-top: 1px dashed var(--border-secondary-color);
  padding-top: 8px;
  text-align: left;
  .ai-subtitle {
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
    margin-bottom: 4px;
    font-weight: 500;
  }
  .ai-rule,
  .ai-vocab {
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--fg-primary-color);
    margin-bottom: 6px;
    b {
      color: var(--fg-accent-color);
    }
  }
}

.popover-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: var(--bg-secondary-color);
  border-top: 1px solid var(--border-secondary-color);
}

.pos-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;

  &.pos-noun {
    color: #3b82f6;
    background-color: rgba(59, 130, 246, 0.15);
  }
  &.pos-verb {
    color: #ef4444;
    background-color: rgba(239, 68, 68, 0.15);
  }
  &.pos-adj {
    color: #10b981;
    background-color: rgba(16, 185, 129, 0.15);
  }
  &.pos-pronoun {
    color: #8b5cf6;
    background-color: rgba(139, 92, 246, 0.15);
  }
  &.pos-default {
    color: var(--fg-primary-color);
    background-color: var(--bg-overlay-secondary-color);
  }
}

.popover-actions {
  display: flex;
  gap: 4px;

  :deep(.kit-btn-icon) {
    font-size: 1.2rem;
  }

  .is-active-ai {
    :deep(.kit-btn-icon) {
      color: var(--fg-accent-color) !important;
    }
  }

  .is-saved-star {
    :deep(.kit-btn-icon) {
      color: #e3b341 !important;
    }
  }

  .pulse-animation {
    :deep(.kit-btn-icon) {
      animation: pulse-op 1.5s infinite;
      color: var(--fg-accent-color) !important;
    }
  }

  .spin-animation {
    :deep(.kit-btn-icon) {
      animation: spin 1s linear infinite;
    }
  }
}

@keyframes pulse-op {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.content-fade-enter-active {
  transition:
    opacity 0.3s ease 0.15s,
    transform 0.3s ease 0.15s;
}
.content-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.content-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.content-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.dropdown-menu-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
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
  width: 100%;

  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    font-size: 1.25rem;
    color: var(--fg-secondary-color);
  }

  &:hover:not(:disabled) svg {
    color: var(--fg-accent-color);
  }
}
</style>
