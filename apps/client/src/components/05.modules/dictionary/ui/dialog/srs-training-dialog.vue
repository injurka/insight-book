<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog, KitSelect } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { api } from '~/shared/services/api.service'
import { useSrsSession } from '../../composables/use-srs-session'
import { useDictionaryStore } from '../../store/dictionary.store'
import SrsCardView from './srs-training/srs-card-view.vue'
import SrsSetupView from './srs-training/srs-setup-view.vue'
import SrsSummaryView from './srs-training/srs-summary-view.vue'
</script>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { useDictionaryStore } from '../../../store/dictionary.store'

const visible = defineModel<boolean>('visible', { required: true })
const dictStore = useDictionaryStore()
const toast = useToast()
const { t } = useI18n()

const {
  sessionState,
  currentIndex,
  stats,
  timeSpentMs,
  accuracy,
  startSession: _startSession,
  finishSession,
  recordAnswer,
  reset: resetSession,
} = useSrsSession()

const isSubmittingGrade = ref(false)
const activeModes = ref<Record<string, boolean>>({
  standard: true,
  audio: true,
  writing: false,
  typing: true,
  choice: true,
  cloze: true,
  dictation: true,
})

const remainingQueue = computed(() => dictStore.reviewQueue.slice(currentIndex.value))
const newCount = computed(() => remainingQueue.value.filter(c => c.status === 0).length)
const reviewCount = computed(() => remainingQueue.value.filter(c => c.status > 0).length)
const currentCard = computed(() => dictStore.reviewQueue[currentIndex.value])
const isFinished = computed(() => currentIndex.value >= dictStore.reviewQueue.length)

const activeView = computed(() => {
  if (sessionState.value === 'setup')
    return SrsSetupView
  if (sessionState.value === 'finished')
    return SrsSummaryView
  return SrsCardView
})

async function startSession(options: {
  deckId: number | 'all' | 'none'
  difficulty: string | 'all' | 'none'
  modes: Record<string, boolean>
}) {
  try {
    activeModes.value = options.modes
    await dictStore.fetchTrainingQueue({
      mode: dictStore.trainingMode,
      deckId: options.deckId,
      difficulty: options.difficulty,
    })

    if (dictStore.reviewQueue.length === 0) {
      toast.info(t('dictionary.emptySearch'))
      return
    }

    _startSession()
  }
  catch {
    toast.error(t('dictionary.loadCardsError'))
  }
}

async function handleGrade(grade: number) {
  if (isSubmittingGrade.value || !currentCard.value)
    return

  const isNew = currentCard.value.status === 0
  recordAnswer(isNew, grade)

  if (dictStore.trainingMode === 'random') {
    currentIndex.value++
    return
  }

  isSubmittingGrade.value = true
  try {
    const cardRef = currentCard.value
    await api.dictionary.submitReview(cardRef.id, grade)
    if (grade === 0) {
      dictStore.reviewQueue.push(cardRef)
    }
    currentIndex.value++
  }
  finally {
    isSubmittingGrade.value = false
  }
}

function handleClose() {
  visible.value = false
}

watch(visible, (val) => {
  if (val) {
    resetSession()
  }
  else {
    dictStore.fetchTrainingQueue({ mode: 'srs', deckId: 'all', difficulty: 'all' })
  }
})

watch(currentIndex, () => {
  if (isFinished.value && sessionState.value === 'active') {
    finishSession()
  }
})

const emit = defineEmits(['start', 'close'])

const dictStore = useDictionaryStore()
const { t } = useI18n()

const setupOptions = reactive({
  deckId: dictStore.selectedDeckId as number | 'all' | 'none',
  difficulty: dictStore.selectedDifficulty as string | 'all' | 'none',
})

const modes = reactive({
  standard: true,
  audio: true,
  writing: false,
  typing: true,
  choice: true,
  cloze: true,
  dictation: true,
})

const currentLang = computed(() => {
  if (setupOptions.deckId !== 'all' && setupOptions.deckId !== 'none') {
    const deck = dictStore.decks.find(d => d.id === setupOptions.deckId)
    if (deck)
      return deck.language
  }
  return dictStore.selectedLanguage !== 'all' ? dictStore.selectedLanguage : 'all'
})

const showWritingMode = computed(() => {
  const hasChinese = dictStore.words.some(c => c.language === 'zh' && /[\u4E00-\u9FA5]/.test(c.word || ''))
  return currentLang.value === 'zh' && hasChinese
})

watch(showWritingMode, (newVal) => {
  if (!newVal) {
    modes.writing = false
  }
}, { immediate: true })

const deckOptions = computed(() => {
  const opts: any[] = [
    { label: t('dictionary.allDecks'), value: 'all' },
    { label: t('dictionary.noDeck'), value: 'none' },
  ]
  dictStore.decks.forEach((d) => {
    if (dictStore.selectedLanguage === 'all' || d.language === dictStore.selectedLanguage) {
      opts.push({ label: d.name, value: d.id })
    }
  })
  return opts
})

const difficultyOptions = computed(() => {
  const opts: any[] = [{ label: t('dictionary.allDifficulties'), value: 'all' }, { label: t('dictionary.noDifficulty'), value: 'none' }]
  const lang = currentLang.value !== 'all' ? currentLang.value : 'all'
  const sys = DIFFICULTY_SYSTEMS[lang] || DIFFICULTY_SYSTEMS.all
  sys.forEach(d => opts.push({ label: d.label, value: d.value }))
  return opts
})

watch(deckOptions, (newOpts) => {
  if (!newOpts.some(o => o.value === setupOptions.deckId)) {
    setupOptions.deckId = 'all'
  }
})

watch(difficultyOptions, (newOpts) => {
  if (!newOpts.some(o => o.value === setupOptions.difficulty)) {
    setupOptions.difficulty = 'all'
  }
})

function start() {
  const selectedModes = { ...modes }
  if (!selectedModes.standard && !selectedModes.audio && !selectedModes.writing && !selectedModes.typing && !selectedModes.choice && !selectedModes.cloze && !selectedModes.dictation) {
    selectedModes.standard = true
  }
  emit('start', { ...setupOptions, modes: selectedModes })
}
</script>

<template>
  <KitDialog v-model:visible="visible" :max-width="800" persistent class="srs-dialog">
    <template #header>
      <div class="srs-header">
        <h2 class="dialog-title">
          <template v-if="sessionState === 'setup'">
            {{ dictStore.trainingMode === 'srs' ? t('dictionary.setupSrs') : t('dictionary.setupWarmup') }}
          </template>
          <template v-else-if="sessionState === 'finished'">
            {{ t('dictionary.sessionSummary') }}
          </template>
          <template v-else>
            {{ dictStore.trainingMode === 'srs' ? t('dictionary.reviewSrs') : t('dictionary.randomTraining') }}
          </template>
        </h2>

        <div v-if="sessionState === 'active' && !isFinished && dictStore.trainingMode === 'srs'" class="srs-stats">
          <span class="stat-new" :title="t('dictionary.newCards')">{{ newCount }}</span>
          <span class="stat-review" :title="t('dictionary.onReview')">{{ reviewCount }}</span>
        </div>
        <div v-else-if="sessionState === 'active' && !isFinished" class="srs-stats">
          <span class="stat-review" :title="t('dictionary.cardsLeft')">{{ remainingQueue.length }}</span>
        </div>
      </div>
    </template>

    <div class="srs-training-content">
      <KeepAlive>
        <component
          :is="activeView"
          :card="currentCard"
          :stats="stats"
          :accuracy="accuracy"
          :time-spent-ms="timeSpentMs"
          :is-submitting-grade="isSubmittingGrade"
          :modes="activeModes"
          @start="startSession"
          @grade="handleGrade"
          @close="handleClose"
        />
      </KeepAlive>
    </div>
  </KitDialog>
</template>

<template>
  <div class="setup-state">
    <p class="setup-desc">
      {{ t('dictionary.setupFilters') }}
    </p>

    <div class="settings-group filters-group">
      <div class="form-row">
        <div class="form-col">
          <label>{{ t('dictionary.deck') }}</label>
          <KitSelect v-model="setupOptions.deckId" :options="deckOptions" />
        </div>
        <div class="form-col">
          <label>{{ t('dictionary.difficulty') }}</label>
          <KitSelect v-model="setupOptions.difficulty" :options="difficultyOptions" />
        </div>
      </div>
    </div>

    <div class="settings-group">
      <label class="group-label">{{ t('dictionary.trainingModes') }}</label>
      <div class="modes-grid">
        <div class="mode-card" :class="{ 'is-active': modes.standard }" @click="modes.standard = !modes.standard">
          <Icon icon="mdi:card-text-outline" class="mode-icon" />
          <span class="mode-title">{{ t('dictionary.reading') }}</span>
          <span class="mode-desc">{{ t('dictionary.classicCards') }}</span>
        </div>
        <div class="mode-card" :class="{ 'is-active': modes.typing }" @click="modes.typing = !modes.typing">
          <Icon icon="mdi:keyboard-outline" class="mode-icon" />
          <span class="mode-title">{{ t('dictionary.typing') }}</span>
          <span class="mode-desc">{{ t('dictionary.writeByMemory') }}</span>
        </div>
        <div class="mode-card" :class="{ 'is-active': modes.cloze }" @click="modes.cloze = !modes.cloze">
          <Icon icon="mdi:form-textbox" class="mode-icon" />
          <span class="mode-title">{{ t('dictionary.cloze') }}</span>
          <span class="mode-desc">{{ t('dictionary.clozeDesc') }}</span>
        </div>
        <div class="mode-card" :class="{ 'is-active': modes.choice }" @click="modes.choice = !modes.choice">
          <Icon icon="mdi:format-list-checks" class="mode-icon" />
          <span class="mode-title">{{ t('dictionary.test') }}</span>
          <span class="mode-desc">{{ t('dictionary.multipleChoice') }}</span>
        </div>
        <div class="mode-card" :class="{ 'is-active': modes.audio }" @click="modes.audio = !modes.audio">
          <Icon icon="mdi:headphones" class="mode-icon" />
          <span class="mode-title">{{ t('dictionary.listening') }}</span>
          <span class="mode-desc">{{ t('dictionary.aiSpeech') }}</span>
        </div>
        <div class="mode-card" :class="{ 'is-active': modes.dictation }" @click="modes.dictation = !modes.dictation">
          <Icon icon="mdi:ear-hearing" class="mode-icon" />
          <span class="mode-title">{{ t('dictionary.audioDictation') }}</span>
          <span class="mode-desc">{{ t('dictionary.audioDictationDesc') }}</span>
        </div>
        <div v-if="showWritingMode" class="mode-card" :class="{ 'is-active': modes.writing }" @click="modes.writing = !modes.writing">
          <Icon icon="mdi:draw" class="mode-icon" />
          <span class="mode-title">{{ t('dictionary.writing') }}</span>
          <span class="mode-desc">{{ t('dictionary.hanziByMemory') }}</span>
        </div>
      </div>
    </div>

    <div class="setup-actions">
      <KitBtn variant="tonal" size="sm" @click="emit('close')">
        {{ t('dictionary.cancel') }}
      </KitBtn>
      <KitBtn color="primary" size="sm" @click="start">
        {{ t('dictionary.start') }}
      </KitBtn>
    </div>
  </div>
</template>
```

=== File: components/05.modules/dictionary/ui/dialog/srs-training/srs-setup-view.vue ===
```vue
<style lang="scss">
.srs-dialog {
  .dialog-body {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
    &::-webkit-scrollbar {
      display: none !important;
    }
  }
}
</style>

<style lang="scss" scoped>
.srs-header {
  display: flex;
  align-items: center;
  gap: 16px;

  .dialog-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .srs-stats {
    display: flex;
    gap: 8px;
    font-weight: 600;
    font-size: 0.9rem;

    .stat-new {
      color: var(--fg-info-color);
      border-bottom: 2px solid currentColor;
      padding-bottom: 2px;
    }
    .stat-review {
      color: var(--fg-success-color);
      border-bottom: 2px solid currentColor;
      padding-bottom: 2px;
    }
  }
}

.srs-training-content {
  min-height: 650px;
  display: flex;
  flex-direction: column;
}
</style>

<style lang="scss" scoped>
.setup-state {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 16px;
  flex: 1;

  .setup-desc {
    margin: 0;
    color: var(--fg-secondary-color);
    font-size: 0.95rem;
  }

  .settings-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--bg-secondary-color);
    padding: 20px;
    border-radius: 12px;
    border: 1px solid var(--border-secondary-color);
    flex: 1;

    .group-label {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--fg-primary-color);
      margin-bottom: 4px;
    }

    .modes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 12px;

      .mode-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 8px;
        padding: 16px 12px;
        background: var(--bg-primary-color);
        border: 1px solid var(--border-primary-color);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;

        &:hover {
          border-color: var(--border-secondary-color);
          background: var(--bg-hover-color);
        }

        &.is-active {
          border-color: var(--fg-accent-color);
          background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.05);

          .mode-icon {
            color: var(--fg-accent-color);
          }
        }

        .mode-icon {
          font-size: 2rem;
          color: var(--fg-secondary-color);
          transition: color 0.2s;
        }

        .mode-title {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--fg-primary-color);
        }

        .mode-desc {
          font-size: 0.75rem;
          color: var(--fg-muted-color);
          line-height: 1.3;
        }
      }
    }
  }

  .filters-group {
    flex: 0;

    .form-row {
      display: flex;
      gap: 12px;
      @include media-down(sm) {
        flex-direction: column;
      }
    }
    .form-col {
      flex: 1;
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

  .setup-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: auto;
  }
}
</style>
