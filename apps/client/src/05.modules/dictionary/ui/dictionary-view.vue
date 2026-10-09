<script setup lang="ts">
import type { UserDictItem } from '~/01.shared/types/models'
import { useRoute } from 'vue-router'
import { KitHoverRevealBg } from '~/02.kit/atoms/kit-hover-reveal-bg/ui'
import { useDictionaryStore } from '../store/dictionary.store'
import BulkMoveDialog from './dialog/bulk-move-dialog.vue'
import DictionaryDiscoverDialog from './dialog/dictionary-discover-dialog.vue'
import DictionaryQuizDialog from './dialog/dictionary-quiz-dialog.vue'
import DictionaryStatsDialog from './dialog/dictionary-stats-dialog.vue'
import ManageDecksDialog from './dialog/manage-decks-dialog.vue'
import DictionaryHeader from './partials/dictionary-header.vue'
import DictionaryList from './partials/dictionary-list.vue'

const store = useDictionaryStore()
const router = useRouter()
const route = useRoute()

const SrsTrainingDialog = lazyComponent(() => import('~/05.modules/srs-training/ui/dialog/srs-training-dialog.vue'))
const DictWordDetailsModal = lazyComponent(() => import('~/04.features/dict-word/ui/dict-word-details-modal.vue'))
const isTrainingOpen = ref(false)
const isEditMode = ref(false)
const viewMode = ref<'list' | 'grid'>('list')
const isManageDecksOpen = ref(false)
const isDiscoverOpen = ref(false)
const isBulkMoveOpen = ref(false)
const isStatsModalOpen = ref(false)
const isDetailsModalOpen = ref(false)
const selectedWordDetails = ref<UserDictItem | null>(null)
const isQuizOpen = ref(false)
const quizLang = ref('zh')
const quizLevel = ref('')
const statsDialog = ref<InstanceType<typeof DictionaryStatsDialog> | null>(null)
let detailsRequest = 0

watch(isTrainingOpen, (newVal, oldVal) => {
  if (oldVal === true && newVal === false)
    statsDialog.value?.fetchActivity()
})
watch(isEditMode, (val) => {
  if (!val)
    store.clearSelection()
})
watch(() => route.query.word, (word) => {
  if (typeof word === 'string')
    openWordDetails(word)
})
watch(isDetailsModalOpen, (isOpen) => {
  if (!isOpen)
    detailsRequest++

  if (!isOpen && route.query.word)
    router.replace({ query: { ...route.query, word: undefined } })
})

function handleOpenQuiz(data: { language: string, levelValue: string }) {
  quizLang.value = data.language
  quizLevel.value = data.levelValue
  isQuizOpen.value = true
}
async function openWordDetails(word: string) {
  const request = ++detailsRequest

  try {
    const item = await store.getWord(word)

    if (request !== detailsRequest)
      return

    selectedWordDetails.value = item
    isDetailsModalOpen.value = true
  }
  catch (error) {
    console.warn('Could not load dictionary word:', error)
  }
}
function openDetails(item: UserDictItem) {
  selectedWordDetails.value = item
  isDetailsModalOpen.value = true
  openWordDetails(item.word)
}
function openTrainingSettings(_mode: 'srs' | 'deep_dive' | 'cram' | 'match') {
  isTrainingOpen.value = true
}

onMounted(() => {
  store.fetchDictionary(false)

  if (typeof route.query.word === 'string')
    openWordDetails(route.query.word)
})
onUnmounted(() => {
  detailsRequest++
})
</script>

<template>
  <div class="dictionary-page">
    <KitHoverRevealBg />

    <DictionaryHeader
      v-model:is-edit-mode="isEditMode"
      v-model:view-mode="viewMode"
      @open-training="openTrainingSettings"
      @open-discover="isDiscoverOpen = true"
      @open-manage-decks="isManageDecksOpen = true"
      @open-stats="isStatsModalOpen = true"
      @open-quiz="handleOpenQuiz({ language: 'zh', levelValue: '' })"
    />

    <div class="dict-layout">
      <DictionaryList
        :is-edit-mode="isEditMode"
        :view-mode="viewMode"
        @open-details="openDetails"
        @open-bulk-move="isBulkMoveOpen = true"
      />
    </div>

    <ManageDecksDialog v-model:visible="isManageDecksOpen" />
    <BulkMoveDialog v-model:visible="isBulkMoveOpen" />
    <DictionaryStatsDialog ref="statsDialog" v-model:visible="isStatsModalOpen" @open-quiz="handleOpenQuiz" />
    <DictionaryQuizDialog
      v-model:visible="isQuizOpen"
      :initial-lang="quizLang"
      :initial-level="quizLevel"
      @success="store.fetchDictionary(); statsDialog?.fetchActivity()"
    />
    <SrsTrainingDialog v-model:visible="isTrainingOpen" />
    <DictionaryDiscoverDialog v-model:visible="isDiscoverOpen" />
    <DictWordDetailsModal v-model:visible="isDetailsModalOpen" :word="selectedWordDetails" />
  </div>
</template>

<style lang="scss" scoped>
.dictionary-page {
  padding-top: calc(16px + var(--safe-area-top));
  padding: 12px;
  position: relative;
  z-index: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  height: 100%;
  min-height: 0 !important;
  max-height: 100%;
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  display: flex;
  flex-direction: column;

  @include media-down(md) {
    padding-top: calc(8px + var(--safe-area-top));
  }
}

.dict-layout {
  display: flex;
  flex-grow: 1;
  gap: 20px;
  min-height: 0;
  overflow: hidden;
}
</style>
