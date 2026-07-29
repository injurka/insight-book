<script setup lang="ts">
import type { UserDictItem } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog, KitDropdown, KitTooltip } from '~/components/01.kit'
import { PronunciationCheck } from '~/components/04.features/pronunciation-check'
import { useTts } from '~/shared/composables/use-tts'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { vLongPress } from '~/shared/directives/long-press'
import { useAnalysisStore } from '~/shared/store/analysis/analysis.store'
import { useAuthStore } from '~/shared/store/auth.store'
import { useDictWordExamples } from '../composables/use-dict-word-examples'

interface Props {
  word: UserDictItem | null
}

const props = defineProps<Props>()
const visible = defineModel<boolean>('visible', { required: true })
const { speak, isPlaying, isLoading: isTtsLoading, stop } = useTts()
const { aiData, isAiLoading, generateExamples, clear } = useDictWordExamples()
const analysisStore = useAnalysisStore()
const authStore = useAuthStore()
const { t } = useI18n()

const LlmChatModal = lazyComponent(() => import('~/components/04.features/llm-chat/ui/llm-chat-modal.vue'))
const AiExamplesModal = lazyComponent(() => import('~/components/04.features/analysis/ui/modal/ai-examples-modal.vue'))

const isChatModalOpen = ref(false)
const isAiModalOpen = ref(false)
const isTtsPopoverOpen = ref(false)
const isAdmin = computed(() => authStore.user?.role === 'admin')

watch(visible, (isOpen) => {
  if (isOpen) {
    clear()
  }
  else {
    stop()
  }
})

function openTtsPopover() {
  if (isAdmin.value) {
    isTtsPopoverOpen.value = true
  }
}

function playTTS(forceCacheBypass = false) {
  if (props.word?.word) {
    speak(
      props.word.word,
      props.word.language,
      undefined,
      forceCacheBypass,
    )
  }
}

function handleGenerate() {
  if (props.word) {
    generateExamples(props.word.word, props.word.language)
    isAiModalOpen.value = true
  }
}

function openEdit() {
  if (props.word) {
    visible.value = false
    analysisStore.wordToEdit = props.word
    analysisStore.addEditWordModalOpen = true
  }
}

function getStatusLabel(state: number) {
  switch (state) {
    case 0: return { label: t('dictionary.statusNew'), color: 'var(--fg-info-color)' }
    case 1: return { label: t('dictionary.statusLearning'), color: 'var(--fg-warning-color)' }
    case 2: return { label: t('dictionary.statusReview'), color: 'var(--fg-success-color)' }
    case 3: return { label: t('dictionary.statusRelearning'), color: 'var(--fg-error-color)' }
    default: return { label: t('dictionary.statusUnknown'), color: 'var(--fg-muted-color)' }
  }
}

const difficultyClass = computed(() => {
  if (!props.word?.difficulty)
    return ''
  const system = DIFFICULTY_SYSTEMS[props.word.language] || DIFFICULTY_SYSTEMS.default
  const found = system.find(s => s.value === props.word?.difficulty)

  if (!found)
    return ''
  if (found.level <= 2)
    return 'level-easy'
  if (found.level <= 4)
    return 'level-medium'
  return 'level-hard'
})
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="t('dictWord.cardDetails')"
    :minimizable="false"
    :max-width="650"
    z-index="1350"
  >
    <div v-if="word" class="word-details-content">
      <div class="word-header-box">
        <span class="status-badge" :style="{ color: getStatusLabel(word.state).color, borderColor: getStatusLabel(word.state).color }">
          {{ getStatusLabel(word.state).label }}
        </span>
        <span v-if="word.difficulty" class="diff-badge" :class="difficultyClass">
          {{ word.difficulty }}
        </span>

        <h2 class="main-word">
          {{ word.word }}
        </h2>
        <p v-if="word.transcription" class="transcription">
          {{ word.transcription }}
        </p>

        <PronunciationCheck
          v-if="word"
          :word="word.word"
          :language="word.language"
          variant="inline"
        />

        <div class="card-toolbar">
          <div class="toolbar-group">
            <KitDropdown
              v-model="isTtsPopoverOpen"
              placement="bottom-start"
              width="260px"
              :disabled="true"
            >
              <template #activator>
                <KitTooltip :text="t('analysis.voice')" placement="bottom">
                  <KitBtn
                    v-long-press="openTtsPopover"
                    :icon="isPlaying ? 'mdi:stop' : 'mdi:volume-high'"
                    variant="tonal"
                    color="secondary"
                    size="sm"
                    :loading="isTtsLoading"
                    :class="{ 'pulse-animation': isPlaying, 'is-active-btn': isTtsPopoverOpen }"
                    @click="playTTS(false)"
                    @contextmenu.prevent="openTtsPopover"
                  />
                </KitTooltip>
              </template>
              <div class="dropdown-menu-list">
                <button class="dropdown-item" @click="playTTS(true); isTtsPopoverOpen = false">
                  <Icon icon="mdi:refresh" />
                  {{ t('dictWord.forceNewVoiceover') }}
                </button>
              </div>
            </KitDropdown>
            <PronunciationCheck
              v-if="word"
              :word="word.word"
              :language="word.language"
              variant="button"
              btn-size="sm"
              btn-color="secondary"
              btn-variant="tonal"
              tooltip-placement="bottom"
            />
          </div>
          <div class="toolbar-divider" />
          <div class="toolbar-group">
            <KitTooltip :text="t('dictionary.aiFreeQuestion')" placement="bottom">
              <KitBtn
                variant="tonal"
                color="secondary"
                size="sm"
                icon="mdi:chat-processing-outline"
                @click="isChatModalOpen = true"
              />
            </KitTooltip>
            <KitTooltip :text="aiData ? t('dictWord.regenerate') : t('dictWord.generateExamples')" placement="bottom">
              <KitBtn
                v-if="!isAiLoading"
                variant="tonal"
                color="secondary"
                size="sm"
                :icon="aiData ? 'mdi:refresh' : 'mdi:robot-outline'"
                @click="handleGenerate"
              />
            </KitTooltip>
          </div>
        </div>
      </div>

      <div v-if="word.translation" class="detail-section">
        <h4 class="section-title">
          <Icon icon="mdi:translate" /> {{ t('analysis.translation') }}
        </h4>
        <div class="html-content" v-html="word.translation" />
      </div>

      <div v-if="word.grammarNote || word.vocabularyNote" class="rule-sections">
        <div v-if="word.grammarNote" class="detail-section">
          <h4 class="section-title">
            <Icon icon="mdi:puzzle-outline" /> {{ t('analysis.grammar') }}
          </h4>
          <div class="html-content" v-html="word.grammarNote" />
        </div>
        <div v-if="word.vocabularyNote" class="detail-section">
          <h4 class="section-title">
            <Icon icon="mdi:book-open-page-variant-outline" /> {{ t('analysis.vocabulary') }}
          </h4>
          <div class="html-content" v-html="word.vocabularyNote" />
        </div>
      </div>

      <div v-if="word.notes" class="detail-section">
        <h4 class="section-title">
          <Icon icon="mdi:note-text-outline" /> {{ t('dictionary.notesMnemonic') }}
        </h4>
        <div class="html-content plain-text" v-html="word.notes" />
      </div>

      <div v-if="word.encounters && word.encounters.length > 0" class="detail-section">
        <h4 class="section-title">
          <Icon icon="mdi:text-search" /> {{ t('dictWord.contextFromBooks') }}
        </h4>
        <ul class="encounters-list">
          <li v-for="enc in word.encounters" :key="enc.id" class="encounter-item">
            <span class="book-title">{{ enc.book?.title || t('dictWord.fromBook') }}:</span>
            <span class="sentence">{{ enc.sentence }}</span>
          </li>
        </ul>
      </div>
    </div>

    <template #footer>
      <KitBtn variant="tonal" @click="visible = false">
        {{ t('dictWord.close') }}
      </KitBtn>
      <KitBtn color="primary" icon="mdi:pencil-outline" @click="openEdit">
        {{ t('dictWord.edit') }}
      </KitBtn>
    </template>
  </KitDialog>

  <LlmChatModal
    v-if="word"
    v-model:visible="isChatModalOpen"
    :word="word.word"
    :language="word.language || 'en'"
  />
  <AiExamplesModal v-model:visible="isAiModalOpen" :loading="isAiLoading" :data="aiData" />
</template>

<style lang="scss" scoped>
.word-details-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.word-header-box {
  position: relative;
  text-align: center;
  background: var(--bg-secondary-color);
  padding: 56px 24px 24px;
  padding-bottom: 16px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);

  .main-word {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--fg-accent-color);
    text-align: center;
    word-break: break-word;
  }

  .transcription {
    font-size: 1.2rem;
    color: var(--fg-secondary-color);
    margin: 8px 0 0 0;
  }

  .card-toolbar {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 12px;
    margin: 0px auto 0 auto;
    width: fit-content;

    .toolbar-group {
      display: flex;
      gap: 8px;
    }

    .toolbar-divider {
      width: 1px;
      height: 24px;
      background-color: var(--border-secondary-color);
    }
  }

  .status-badge {
    position: absolute;
    top: 12px;
    left: 12px;
    font-size: 0.8rem;
    padding: 2px 8px;
    border: 1px solid;
    border-radius: 6px;
    font-weight: 600;
    background: var(--bg-primary-color);
  }

  .diff-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    font-size: 0.8rem;
    padding: 3px 8px;
    border-radius: 6px;
    font-weight: 500;
    background-color: var(--bg-tertiary-color);
    color: var(--fg-primary-color);

    &.level-easy {
      background-color: rgba(var(--bg-success-color-rgb, 86, 211, 100), 0.15);
      color: var(--fg-success-color);
    }
    &.level-medium {
      background-color: rgba(var(--bg-warning-color-rgb, 227, 179, 65), 0.15);
      color: var(--fg-warning-color);
    }
    &.level-hard {
      background-color: rgba(var(--bg-error-color-rgb, 248, 81, 73), 0.15);
      color: var(--fg-error-color);
    }
  }
}

.detail-section {
  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 8px 0;
  }

  .html-content {
    font-size: 1.05rem;
    line-height: 1.5;
    color: var(--fg-primary-color);
    background: var(--bg-secondary-color);
    padding: 12px 16px;
    border-radius: 8px;
    border-left: 3px solid var(--border-secondary-color);

    &.plain-text {
      white-space: pre-wrap;
    }

    :deep(b) {
      color: var(--fg-accent-color);
    }
  }
}

.rule-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.encounters-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .encounter-item {
    font-size: 0.95rem;
    font-style: italic;
    padding: 8px 12px;
    background: var(--bg-tertiary-color);
    border-radius: 6px;

    .book-title {
      font-weight: 600;
      color: var(--fg-secondary-color);
      margin-right: 6px;
      font-style: normal;
    }
  }
}

.spin-animation {
  :deep(svg) {
    animation: spin 1s linear infinite;
  }
}
.pulse-animation {
  animation: pulse 1.2s infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
  }
}
.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.mb-2 {
  margin-bottom: 8px;
}

.pronunciation-result {
  background-color: var(--bg-secondary-color);
  border-radius: 12px;
  padding: 16px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .pron-header {
    display: flex;
    align-items: center;
    gap: 12px;

    .pron-score {
      font-size: 1.3rem;
      font-weight: bold;
      padding: 4px 12px;
      border-radius: 6px;
      color: white;

      &.is-success {
        background-color: var(--fg-success-color);
      }
      &.is-warning {
        background-color: var(--fg-warning-color);
      }
      &.is-error {
        background-color: var(--fg-error-color);
      }
    }

    .pron-label {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    .user-audio-btn {
      margin-left: auto;
    }
  }

  .pron-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--bg-primary-color);
    padding: 12px;
    border-radius: 8px;
    border: 1px dashed var(--border-primary-color);

    .pron-row {
      display: flex;
      gap: 8px;
      font-size: 0.95rem;

      .row-label {
        color: var(--fg-secondary-color);
        min-width: 80px;
        flex-shrink: 0;
      }

      .row-value {
        color: var(--fg-primary-color);
        font-weight: 500;

        .transcription-hint {
          color: var(--fg-muted-color);
          font-weight: normal;
          font-size: 0.9em;
          margin-left: 4px;
        }

        &.is-error b {
          color: var(--fg-error-color);
        }

        b {
          font-weight: 600;
        }
      }

      &.analysis-row {
        margin-top: 4px;
        padding-top: 8px;
        border-top: 1px dotted var(--border-secondary-color);

        .row-value {
          font-weight: normal;
          color: var(--fg-secondary-color);

          :deep(*) {
            margin: 0;
            display: inline;
          }
        }
      }
    }
  }
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
    flex-shrink: 0;
  }

  &:hover:not(:disabled) svg {
    color: var(--fg-accent-color);
  }
}
</style>
