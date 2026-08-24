<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useFullscreen } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRepos } from '~/00.plugins/di'
import { useToast } from '~/01.shared/composables/use-toast'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'

import { Flashcard } from '~/03.domain/entities/flashcard.entity.ts'
import { useSrsSession } from '../../composables/use-srs-session'
import { useTrainingStore } from '../../store/training.store'
import SrsCardView from './srs-training-views/srs-card-view.vue'
import SrsModeMatch from './srs-training-views/srs-mode-match.vue'
import SrsSetupView from './srs-training-views/srs-setup-view.vue'
import SrsSummaryView from './srs-training-views/srs-summary-view.vue'

const repos = useRepos()

const visible = defineModel<boolean>('visible', { required: true })
const trainingStore = useTrainingStore()
const toast = useToast()
const { t } = useI18n()
const {
  isFullscreen: isNativeFullscreen,
  toggle: toggleNativeFullscreen,
  isSupported: isNativeFullscreenSupported,
} = useFullscreen()
const isLocalFullscreen = ref(false)

const isFullscreen = computed(() => isNativeFullscreen.value || isLocalFullscreen.value)

async function toggleFullscreen() {
  isLocalFullscreen.value = !isLocalFullscreen.value
  if (isNativeFullscreenSupported.value) {
    try {
      if (isLocalFullscreen.value && !isNativeFullscreen.value)
        await toggleNativeFullscreen()

      else if (!isLocalFullscreen.value && isNativeFullscreen.value)
        await toggleNativeFullscreen()
    }
    catch (e) {
      console.warn('Native fullscreen failed', e)
    }
  }
}

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
  'standard': false,
  'audio': false,
  'writing': false,
  'typing': false,
  'choice': false,
  'choice-reverse': false,
  'scramble': false,
  'collocations': false,
  'radicals': false,
})

const remainingQueue = computed(() => trainingStore.reviewQueue.slice(currentIndex.value))
const newCount = computed(() => remainingQueue.value.filter(c => new Flashcard(c).isNew()).length)
const reviewCount = computed(() => remainingQueue.value.filter(c => new Flashcard(c).isReview() || new Flashcard(c).isLearning()).length)
const currentCard = computed(() => trainingStore.reviewQueue[currentIndex.value])
const isFinished = computed(() => currentIndex.value >= trainingStore.reviewQueue.length)

const activeView = computed(() => {
  if (sessionState.value === 'setup')
    return SrsSetupView
  if (sessionState.value === 'finished')
    return SrsSummaryView
  if (trainingStore.trainingMode === 'match')
    return SrsModeMatch

  return SrsCardView
})

async function startSession(options: {
  deckId: (number | 'all' | 'none')[] | number | 'all' | 'none'
  difficulty: string[]
  modes: Record<string, boolean>
}) {
  try {
    activeModes.value = options.modes
    await trainingStore.fetchTrainingQueue({
      mode: trainingStore.trainingMode,
      deckId: options.deckId,
      difficulty: options.difficulty,
    })

    if (trainingStore.reviewQueue.length === 0) {
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

  const isNew = new Flashcard(currentCard.value).isNew()
  recordAnswer(isNew, grade)

  if (trainingStore.trainingMode === 'deep_dive' || trainingStore.trainingMode === 'cram' || trainingStore.trainingMode === 'match') {
    if (grade === 1 && trainingStore.trainingMode === 'cram')
      trainingStore.reviewQueue.push(currentCard.value)

    currentIndex.value++

    return
  }

  isSubmittingGrade.value = true
  try {
    const cardRef = currentCard.value
    await repos.dictionary.submitReview(cardRef.id, grade)
    if (grade === 1) { // 1 = Rating.Again in FSRS
      trainingStore.reviewQueue.push(cardRef)
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
  if (val)
    resetSession()

  else
    trainingStore.fetchTrainingQueue({ mode: 'srs', deckId: ['all'], difficulty: ['all'] })
})

watch(currentIndex, () => {
  if (isFinished.value && sessionState.value === 'active')
    finishSession()
})
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :max-width="800"
    persistent
    class="srs-dialog"
    :minimizable="false"
    :fullscreen="isFullscreen"
  >
    <template #header-actions>
      <button
        class="dialog-icon-btn fullscreen-button"
        :aria-label="isFullscreen ? 'Обычный экран' : 'На весь экран'"
        :title="isFullscreen ? 'Обычный экран' : 'На весь экран'"
        @click="toggleFullscreen"
      >
        <Icon :icon="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" />
      </button>
    </template>

    <template #header>
      <div class="srs-header">
        <h2 class="dialog-title">
          <template v-if="sessionState === 'setup'">
            {{ trainingStore.trainingMode === 'srs' ? t('dictionary.setupSrs') : trainingStore.trainingMode === 'cram' ? 'Зубрёжка' : trainingStore.trainingMode === 'match' ? 'Матчинг' : t('dictionary.deepDiveTraining') }}
          </template>
          <template v-else-if="sessionState === 'finished'">
            {{ t('dictionary.sessionSummary') }}
          </template>
          <template v-else>
            {{ trainingStore.trainingMode === 'srs' ? t('dictionary.reviewSrs') : trainingStore.trainingMode === 'cram' ? 'Зубрёжка' : trainingStore.trainingMode === 'match' ? 'Матчинг' : t('dictionary.deepDiveTraining') }}
          </template>
        </h2>

        <div v-if="sessionState === 'active' && !isFinished && trainingStore.trainingMode === 'srs'" class="srs-stats">
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
          :current-index="currentIndex"
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
    flex-grow: 1;

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
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}
</style>
