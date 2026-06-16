<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitDialog } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { api } from '~/shared/services/api.service'
import { useSrsSession } from '../../composables/use-srs-session'
import { useDictionaryStore } from '../../store/dictionary.store'
import SrsCardView from './srs-training/srs-card-view.vue'
import SrsSetupView from './srs-training/srs-setup-view.vue'
import SrsSummaryView from './srs-training/srs-summary-view.vue'

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
  scramble: false,
  collocations: false,
  radicals: false,
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

  if (dictStore.trainingMode === 'random' || dictStore.trainingMode === 'deep_dive') {
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
</script>

<template>
  <KitDialog v-model:visible="visible" :max-width="800" persistent class="srs-dialog" :minimizable="false">
    <template #header>
      <div class="srs-header">
        <h2 class="dialog-title">
          <template v-if="sessionState === 'setup'">
            {{ dictStore.trainingMode === 'srs' ? t('dictionary.setupSrs') : (dictStore.trainingMode === 'deep_dive' ? t('dictionary.deepDiveTraining') : t('dictionary.setupWarmup')) }}
          </template>
          <template v-else-if="sessionState === 'finished'">
            {{ t('dictionary.sessionSummary') }}
          </template>
          <template v-else>
            {{ dictStore.trainingMode === 'srs' ? t('dictionary.reviewSrs') : (dictStore.trainingMode === 'deep_dive' ? t('dictionary.deepDiveTraining') : t('dictionary.randomTraining')) }}
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
