<script setup lang="ts">
import type { TagKey } from '~/shared/constants/tags'
import type { UserDictItem } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog, KitSkeleton, KitTooltip } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { useTts } from '~/shared/composables/use-tts'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { BOOK_TAGS } from '~/shared/constants/tags'
import { api } from '~/shared/services/api.service'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useDictWordExamples } from '../composables/use-dict-word-examples'

const props = defineProps<{ word: UserDictItem | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const { speak, isPlaying, isLoading: isTtsLoading, stop } = useTts()
const { aiData, isAiLoading, generateExamples, clear } = useDictWordExamples()
const analysisStore = useAnalysisStore()
const settingsStore = useGlobalSettingsStore()
const { t } = useI18n()
const LlmChatModal = lazyComponent(() => import('~/components/04.features/llm-chat/ui/llm-chat-modal.vue'))

const toast = useToast()
const isChatModalOpen = ref(false)

// --- Pronunciation Check State ---
const isRecording = ref(false)
const isAnalyzingAudio = ref(false)
const pronScore = ref<number | null>(null)
const pronHeardText = ref<string>('')
const pronHeardPhonetic = ref<string>('')
const pronMistakeAnalysis = ref<string>('')

let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []

const userAudioUrl = ref<string | null>(null)
let userAudio: HTMLAudioElement | null = null
const isUserAudioPlaying = ref(false)

watch(visible, (isOpen) => {
  if (isOpen) {
    clear()
  }
  else {
    stop()
    pronScore.value = null
    pronHeardText.value = ''
    pronHeardPhonetic.value = ''
    pronMistakeAnalysis.value = ''
    isRecording.value = false
    isAnalyzingAudio.value = false
    isUserAudioPlaying.value = false
    if (userAudio) {
      userAudio.pause()
      userAudio = null
    }
    if (userAudioUrl.value) {
      URL.revokeObjectURL(userAudioUrl.value)
      userAudioUrl.value = null
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
  }
})

// --- Pronunciation Check Logic ---
function playUserAudio() {
  if (!userAudioUrl.value)
    return
  if (isUserAudioPlaying.value && userAudio) {
    userAudio.pause()
    userAudio.currentTime = 0
    isUserAudioPlaying.value = false
    return
  }
  userAudio = new Audio(userAudioUrl.value)
  userAudio.onplay = () => isUserAudioPlaying.value = true
  userAudio.onended = () => isUserAudioPlaying.value = false
  userAudio.play()
}

async function toggleRecording() {
  if (isRecording.value) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    isRecording.value = false
    return
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(stream)
    audioChunks = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0)
        audioChunks.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
      stream.getTracks().forEach(track => track.stop())

      if (userAudioUrl.value)
        URL.revokeObjectURL(userAudioUrl.value)
      userAudioUrl.value = URL.createObjectURL(audioBlob)

      if (!props.word?.word)
        return

      isAnalyzingAudio.value = true
      pronScore.value = null

      try {
        const res = await api.dictionary.checkPronunciation(props.word.word, props.word.language, audioBlob)
        pronScore.value = res.score
        pronHeardText.value = res.heardText
        pronHeardPhonetic.value = res.heardPhonetic || ''
        pronMistakeAnalysis.value = res.mistakeAnalysis || ''
      }
      catch {
        toast.error('Не удалось проверить произношение (Проверьте API-ключи)')
      }
      finally {
        isAnalyzingAudio.value = false
      }
    }

    mediaRecorder.start()
    isRecording.value = true
    pronScore.value = null
  }
  catch {
    toast.error('Доступ к микрофону запрещен')
  }
}

const pronScoreClass = computed(() => {
  if (pronScore.value === null)
    return ''
  if (pronScore.value >= 85)
    return 'is-success'
  if (pronScore.value >= 50)
    return 'is-warning'
  return 'is-error'
})

function playTTS() {
  if (props.word?.word) {
    speak(props.word.word, props.word.language)
  }
}

function handleGenerate() {
  if (props.word) {
    generateExamples(props.word.word, props.word.language)
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

const tagsList = computed(() => {
  if (!props.word?.tags)
    return []
  const tags = props.word.tags.split(',').map(t => t.trim()).filter(Boolean)
  return tags.map((tag) => {
    const match = BOOK_TAGS[tag as TagKey]?.[settingsStore.appLanguage as keyof (typeof BOOK_TAGS)[TagKey]]
    if (match)
      return match
    return tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  })
})
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="t('dictWord.cardDetails')"
    :max-width="650"
    z-index="1350"
  >
    <div v-if="word" class="word-details-content">
      <div class="word-header-box">
        <div class="title-row">
          <div class="title-spacer" />
          <h2 class="main-word">
            {{ word.word }}
          </h2>
          <div class="tts-wrapper">
            <KitTooltip :text="t('analysis.voice')">
              <KitBtn
                :icon="isTtsLoading ? 'mdi:loading' : (isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
                variant="text"
                size="md"
                color="accent"
                :class="{ 'spin-animation': isTtsLoading, 'pulse-animation': isPlaying }"
                @click="playTTS"
              />
            </KitTooltip>
            <KitTooltip :text="isRecording ? 'Остановить запись' : 'Проверить произношение'" placement="top">
              <KitBtn
                :icon="isAnalyzingAudio ? 'mdi:loading' : (isRecording ? 'mdi:stop' : 'mdi:microphone')"
                variant="text"
                size="md"
                :color="isRecording ? 'error' : 'secondary'"
                :class="{ 'spin-animation': isAnalyzingAudio, 'pulse-animation': isRecording }"
                @click="toggleRecording"
              />
            </KitTooltip>
          </div>
        </div>
        <p v-if="word.transcription" class="transcription">
          {{ word.transcription }}
        </p>

        <div v-if="pronScore !== null" class="pronunciation-result fade-in" style="margin-top: 16px;">
          <div class="pron-header">
            <span class="pron-score" :class="pronScoreClass">{{ pronScore }}%</span>
            <span class="pron-label">Точность произношения</span>

            <div style="flex-grow: 1;" />

            <KitTooltip text="Прослушать свой голос" placement="top">
              <KitBtn
                v-if="userAudioUrl"
                :icon="isUserAudioPlaying ? 'mdi:stop' : 'mdi:play'"
                size="xs"
                variant="tonal"
                color="primary"
                class="user-audio-btn"
                @click="playUserAudio"
              />
            </KitTooltip>
          </div>

          <div class="pron-details">
            <div class="pron-row">
              <span class="row-label">Услышано:</span>
              <span class="row-value" :class="{ 'is-error': pronScore < 100 }">
                <b>{{ pronHeardText || 'Ничего не распознано' }}</b>
                <span v-if="pronHeardPhonetic" class="transcription-hint">({{ pronHeardPhonetic }})</span>
              </span>
            </div>
            <div v-if="pronMistakeAnalysis" class="pron-row analysis-row">
              <span class="row-label">Анализ:</span>
              <span class="row-value" v-html="pronMistakeAnalysis" />
            </div>
          </div>
        </div>

        <div class="badges-row">
          <span class="status-badge" :style="{ color: getStatusLabel(word.state).color, borderColor: getStatusLabel(word.state).color }">
            {{ getStatusLabel(word.state).label }}
          </span>
          <span v-if="word.difficulty" class="diff-badge" :class="difficultyClass">
            {{ word.difficulty }}
          </span>
          <span v-for="tag in tagsList" :key="tag" class="tag-badge">
            {{ tag }}
          </span>
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

      <div class="divider" />

      <div class="ai-examples-section">
        <div class="ai-header">
          <h4 class="section-title">
            <Icon icon="mdi:robot-outline" /> {{ t('dictWord.aiAssistant') }}
          </h4>
          <div class="ai-header-actions" style="display: flex; gap: 8px;">
            <KitBtn
              variant="outlined"
              color="secondary"
              size="xs"
              icon="mdi:chat-processing-outline"
              @click="isChatModalOpen = true"
            >
              {{ t('dictionary.aiFreeQuestion') }}
            </KitBtn>
            <KitBtn
              v-if="!isAiLoading"
              variant="outlined"
              color="accent"
              size="xs"
              :icon="aiData ? 'mdi:refresh' : undefined"
              @click="handleGenerate"
            >
              {{ aiData ? t('dictWord.regenerate') : t('dictWord.generateExamples') }}
            </KitBtn>
          </div>
        </div>

        <div v-if="isAiLoading" class="ai-loading">
          <KitSkeleton width="100%" height="20px" class="mb-2" />
          <KitSkeleton width="80%" height="20px" class="mb-2" />
          <KitSkeleton width="90%" height="80px" />
        </div>

        <div v-else-if="aiData" class="ai-results fade-in">
          <div v-if="aiData.mnemonics" class="ai-block">
            <h5>{{ t('dictWord.mnemonicsEtymology') }}</h5>
            <p>{{ aiData.mnemonics }}</p>
          </div>

          <div v-if="aiData.examples && aiData.examples.length" class="ai-block">
            <h5>{{ t('dictWord.usageExamples') }}</h5>
            <ul class="ai-list">
              <li v-for="(ex, i) in aiData.examples" :key="i">
                <span class="ex-type">{{ ex.type }}</span>
                <div class="ex-orig">
                  {{ ex.original }}
                </div>
                <div class="ex-transc">
                  {{ ex.transcription }}
                </div>
                <div class="ex-transl">
                  {{ ex.translation }}
                </div>
                <div class="ex-literal">
                  {{ t('analysis.literalTranslation') }}: {{ ex.literal_translation }}
                </div>
              </li>
            </ul>
          </div>

          <div v-if="aiData.collocations && aiData.collocations.length" class="ai-block">
            <h5>{{ t('analysis.collocations') }}</h5>
            <ul class="ai-list simple">
              <li v-for="(col, i) in aiData.collocations" :key="i">
                <b>{{ col.original }}</b> ({{ col.transcription }}) — {{ col.translation }}
              </li>
            </ul>
          </div>

          <div v-if="aiData.relations && (aiData.relations.synonyms?.length || aiData.relations.antonyms?.length)" class="grid-sections">
            <div v-if="aiData.relations.synonyms?.length" class="ai-block">
              <h5>{{ t('analysis.synonyms') }}</h5>
              <ul class="ai-list simple">
                <li v-for="(syn, i) in aiData.relations.synonyms" :key="i">
                  <b>{{ syn.word }}</b> — {{ syn.translation }}
                </li>
              </ul>
            </div>
            <div v-if="aiData.relations.antonyms?.length" class="ai-block">
              <h5>{{ t('analysis.antonyms') }}</h5>
              <ul class="ai-list simple">
                <li v-for="(ant, i) in aiData.relations.antonyms" :key="i">
                  <b>{{ ant.word }}</b> — {{ ant.translation }}
                </li>
              </ul>
            </div>
          </div>
        </div>
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

  <LlmChatModal v-if="word" v-model:visible="isChatModalOpen" :word="word.word" :language="word.language || 'en'" />
</template>

<style lang="scss" scoped>
.word-details-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.word-header-box {
  text-align: center;
  background: var(--bg-secondary-color);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);

  .title-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    width: 100%;
    gap: 8px;
  }

  .title-spacer {
    grid-column: 1;
  }

  .main-word {
    grid-column: 2;
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--fg-accent-color);
    text-align: center;
    word-break: break-word;
  }

  .tts-wrapper {
    grid-column: 3;
    justify-self: start;
  }

  .transcription {
    font-size: 1.2rem;
    color: var(--fg-secondary-color);
    margin: 8px 0 16px 0;
  }

  .badges-row {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;

    .status-badge {
      font-size: 0.8rem;
      padding: 2px 8px;
      border: 1px solid;
      border-radius: 6px;
      font-weight: 600;
      background: var(--bg-primary-color);
    }

    .diff-badge {
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

    .tag-badge {
      font-size: 0.8rem;
      padding: 3px 8px;
      border-radius: 6px;
      background-color: var(--bg-tertiary-color);
      color: var(--fg-secondary-color);
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

.divider {
  height: 1px;
  background-color: var(--border-secondary-color);
  margin: 8px 0;
}

.ai-examples-section {
  .ai-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    height: 28px;
    flex-wrap: wrap;
    gap: 8px;

    .section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.95rem;
      color: var(--fg-accent-color);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
    }
  }

  .ai-loading {
    padding: 16px;
    background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.05);
    border-radius: 12px;
    border: 1px dashed var(--fg-accent-color);
  }

  .ai-results {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .ai-block {
      background: var(--bg-secondary-color);
      border-radius: 8px;
      padding: 16px;
      border: 1px solid var(--border-secondary-color);

      h5 {
        margin: 0 0 12px 0;
        font-size: 0.95rem;
        color: var(--fg-primary-color);
      }

      p {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.4;
      }
    }

    .ai-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;

      li {
        border-bottom: 1px dashed var(--border-primary-color);
        padding-bottom: 12px;
        &:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
      }

      &.simple li {
        border-bottom: none;
        padding-bottom: 0;
        padding-left: 12px;
        position: relative;

        &::before {
          content: '•';
          position: absolute;
          left: 0;
          color: var(--fg-accent-color);
        }
      }

      .ex-type {
        display: inline-block;
        background: var(--bg-tertiary-color);
        color: var(--fg-secondary-color);
        font-size: 0.75rem;
        padding: 2px 6px;
        border-radius: 4px;
        margin-bottom: 4px;
      }
      .ex-orig {
        font-size: 1.1rem;
        font-weight: 500;
        color: var(--fg-primary-color);
      }
      .ex-transc {
        font-size: 0.9rem;
        color: var(--fg-secondary-color);
        margin-bottom: 4px;
      }
      .ex-transl {
        font-size: 0.95rem;
        color: var(--fg-primary-color);
      }
      .ex-literal {
        font-size: 0.85rem;
        color: var(--fg-muted-color);
        font-style: italic;
        margin-top: 4px;
      }
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
</style>
