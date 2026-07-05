<script setup lang="ts">
import type { UserDictItem } from '~/shared/types/models'
import { useRoute } from 'vue-router'
import { HoverRevealBg } from '~/components/02.shared/hover-reveal-bg'
import { useDictionaryStore } from '../store/dictionary.store'
import BulkMoveDialog from './dialog/bulk-move-dialog.vue'
import DictionaryDiscoverDialog from './dialog/dictionary-discover-dialog.vue'
import DictionaryStatsDialog from './dialog/dictionary-stats-dialog.vue'
import ManageDecksDialog from './dialog/manage-decks-dialog.vue'
import SrsTrainingDialog from './dialog/srs-training-dialog.vue'
import DictionaryHeader from './partials/dictionary-header.vue'
import DictionaryList from './partials/dictionary-list.vue'

const DictWordDetailsModal = lazyComponent(() => import('~/components/03.domain/dict-word/ui/dict-word-details-modal.vue'))

const store = useDictionaryStore()
const router = useRouter()
const route = useRoute()

const isTrainingOpen = ref(false)
const isEditMode = ref(false)
const isManageDecksOpen = ref(false)
const isDiscoverOpen = ref(false)
const isBulkMoveOpen = ref(false)
const isStatsModalOpen = ref(false)
const isDetailsModalOpen = ref(false)
const selectedWordDetails = ref<UserDictItem | null>(null)

const statsDialog = ref<InstanceType<typeof DictionaryStatsDialog> | null>(null)

onMounted(() => {
  store.fetchDictionary().then(() => {
    const queryWord = route.query.word as string
    if (queryWord) {
      const found = store.words.find(w => w.word === queryWord)
      if (found)
        openDetails(found)
    }
  })
})

function openDetails(item: UserDictItem) {
  selectedWordDetails.value = item
  isDetailsModalOpen.value = true
}

function openTrainingSettings(mode: 'srs' | 'random' | 'deep_dive') {
  store.trainingMode = mode
  isTrainingOpen.value = true
}

watch(isTrainingOpen, (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {
    store.fetchTrainingQueue({ mode: 'srs', deckId: 'all', difficulty: ['all'] })
    statsDialog.value?.fetchActivity()
  }
})

watch(isEditMode, (val) => {
  if (!val)
    store.clearSelection()
})

watch(() => route.query.word, (newWord) => {
  if (newWord) {
    const found = store.words.find(w => w.word === newWord)
    if (found)
      openDetails(found)
  }
})

watch(isDetailsModalOpen, (isOpen) => {
  if (!isOpen && route.query.word)
    router.replace({ query: { ...route.query, word: undefined } })
})
</script>

<template>
  <div class="dictionary-page">
    <HoverRevealBg />

    <DictionaryHeader
      v-model:is-edit-mode="isEditMode"
      @open-training="openTrainingSettings"
      @open-discover="isDiscoverOpen = true"
      @open-manage-decks="isManageDecksOpen = true"
      @open-stats="isStatsModalOpen = true"
    />

    <div class="dict-layout">
      <DictionaryList
        :is-edit-mode="isEditMode"
        @open-details="openDetails"
        @open-bulk-move="isBulkMoveOpen = true"
      />
    </div>

    <ManageDecksDialog v-model:visible="isManageDecksOpen" />
    <BulkMoveDialog v-model:visible="isBulkMoveOpen" />
    <DictionaryStatsDialog ref="statsDialog" v-model:visible="isStatsModalOpen" />
    <SrsTrainingDialog v-model:visible="isTrainingOpen" />
    <DictionaryDiscoverDialog v-model:visible="isDiscoverOpen" />
    <DictWordDetailsModal v-model:visible="isDetailsModalOpen" :word="selectedWordDetails" />
  </div>
</template>

<style lang="scss" scoped>
.dictionary-page {
  padding-top: var(--safe-area-top) !;

  position: relative;
  z-index: 1;
  padding: 16px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  height: 100%;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  display: flex;
  flex-direction: column;

  @include media-down(md) {
    padding: 8px;
  }
}

.dict-layout {
  display: flex;
  flex-grow: 1;
  gap: 20px;
  min-height: 0;
}
</style>
