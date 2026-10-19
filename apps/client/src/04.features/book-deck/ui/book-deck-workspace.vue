<script setup lang="ts">
import type { BookDeckWord } from '~/01.shared/types/schemas/book-deck.schema'
import { Icon } from '@iconify/vue'
import { isWordContentComplete } from '@injurka/insight-book-language-utils'
import { computed, nextTick, reactive, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { useNetworkStore } from '~/01.shared/store/network.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
import { KitPageHeader } from '~/02.kit/molecules/kit-page-header/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'
import { useBookDeckStore } from '../store/book-deck.store'
import BookDeckFilterPanel from './book-deck-filter-panel.vue'
import BookDeckLoader from './book-deck-loader.vue'
import BookDeckSummary from './book-deck-summary.vue'
import BookDeckWordList from './book-deck-word-list.vue'

interface Props { bookId: number }

const props = defineProps<Props>()

const store = useBookDeckStore()
const network = useNetworkStore()
const { t } = useI18n()
const router = useRouter()
const workspaceRef = useTemplateRef<HTMLElement>('workspaceRef')

const workflowSteps = ['words', 'content', 'filter', 'save'] as const

type WorkflowStep = typeof workflowSteps[number]
type Step = WorkflowStep | 'done'

const step = ref<Step>('words')
const filters = reactive({
  search: '',
  status: 'all',
  names: false,
  frequency: 1,
  maxFrequency: null as number | null,
  page: 0,
})
const contentFilters = reactive({ search: '', status: 'all', page: 0 })
const name = ref('')
const updateExisting = ref(false)
const replacement = ref<BookDeckWord | null>(null)

const currentStepIndex = computed(() => workflowSteps.indexOf(step.value as WorkflowStep))
const confirmVisible = computed({
  get: () => !!replacement.value,
  set: (value) => {
    if (!value)
      replacement.value = null
  },
})
const busy = computed(() => store.state.loading || store.state.running || store.state.saving)
const active = computed(() => store.draft?.bookId === props.bookId ? store.draft : null)
const readyCount = computed(() => store.selectedWords.filter(word => isWordContentComplete(word.content)).length)
const missingCount = computed(() => store.pending.length)
const wordStatusOptions = computed(() => ['all', 'selected', 'dictionary', 'cache', 'missing', 'generated'].map(value => ({ value, label: t(`bookDeck.${value}`) })))
const contentStatusOptions = computed(() => ['all', 'ready', 'missing'].map(value => ({ value, label: t(`bookDeck.${value}`) })))
const filteredWords = computed(() => active.value?.words.filter((word) => {
  const matchesSearch = word.word.toLocaleLowerCase().includes(filters.search.trim().toLocaleLowerCase())
  const matchesFrequency = word.count >= (Number(filters.frequency) || 1)
    && (filters.maxFrequency === null || word.count <= Number(filters.maxFrequency))
  const matchesNames = filters.names || !word.properName
  const matchesStatus = matchesWordStatus(word, filters.status)

  return matchesSearch && matchesFrequency && matchesNames && matchesStatus
}) || [])
const selectedFilteredWords = computed(() => store.selectedWords.filter((word) => {
  const matchesSearch = word.word.toLocaleLowerCase().includes(contentFilters.search.trim().toLocaleLowerCase())
  const matchesStatus = contentFilters.status === 'all'
    || (contentFilters.status === 'missing' ? !isWordContentComplete(word.content) : isWordContentComplete(word.content))

  return matchesSearch && matchesStatus
}))

watch(() => props.bookId, () => {
  if (!network.effectiveOffline)
    store.open(props.bookId)
}, { immediate: true })
watch(() => store.draft?.id, () => {
  name.value = withCombinedSuffix(active.value?.name || '')
  updateExisting.value = false
  step.value = active.value?.deckId ? 'done' : 'words'
  filters.search = ''
  filters.status = 'all'
  filters.frequency = 1
  filters.maxFrequency = null
  filters.names = false
  filters.page = 0
  contentFilters.status = 'all'
  contentFilters.page = 0
  contentFilters.search = ''
}, { immediate: true })
watch(() => active.value?.deckId, (deckId) => {
  if (deckId) {
    step.value = 'done'
  }
})
watch(() => [filters.search, filters.status, filters.names, filters.frequency, filters.maxFrequency], () => {
  filters.page = 0
})
watch(() => [contentFilters.search, contentFilters.status], () => {
  contentFilters.page = 0
})

function matchesWordStatus(word: BookDeckWord, status: string) {
  switch (status) {
    case 'all': return true
    case 'selected': return store.selected.has(word.word)
    case 'missing': return !isWordContentComplete(word.content)
    default: return word.source === status
  }
}
function withCombinedSuffix(value: string) {
  const title = value.trim()

  return !title || /\sCombined$/iu.test(title) ? title : `${title} Combined`
}
function setStep(nextStep: Step) {
  if (busy.value || (['filter', 'save'].includes(nextStep) && missingCount.value > 0) || (nextStep === 'save' && !store.selected.size))
    return

  step.value = nextStep
  nextTick(() => workspaceRef.value?.scrollIntoView?.({ block: 'start' }))
}
function selectFiltered(checked: boolean) {
  store.setSelected(filteredWords.value.map(word => word.word), checked)
}
function removeMissing() {
  if (!busy.value)
    store.setSelected(store.pending.map(word => word.word), false)
}
function generate(word: BookDeckWord) {
  if (busy.value || network.effectiveOffline)
    return

  if (isWordContentComplete(word.content))
    replacement.value = word
  else
    store.generate([word])
}
function regenerate() {
  const word = replacement.value
  replacement.value = null

  if (word && !network.effectiveOffline)
    store.generate([word])
}
function goToDeck() {
  const deckId = active.value?.deckId

  if (deckId) {
    router.push({ path: AppRoutePaths.Dictionary, query: { deck: deckId } })
  }
}
async function createAnother() {
  if (busy.value || network.effectiveOffline)
    return

  await store.open(props.bookId, true)
}

onBeforeRouteLeave(() => {
  if (store.state.saving)
    return false

  store.state.pause = true
})

onUnmounted(() => {
  store.state.pause = true
})
</script>

<template>
  <section ref="workspaceRef" class="book-deck-workspace">
    <header class="workspace-heading">
      <KitPageHeader :title="t('bookDeck.workspaceTitle')" :subtitle="active?.name">
        <template #navigation>
          <KitBtn
            icon="mdi:arrow-left"
            variant="text"
            :disabled="store.state.saving"
            :aria-label="t('bookDeck.backToDecks')"
            @click="router.push(AppRoutePaths.Dictionary)"
          />
        </template>
        <template v-if="active" #actions>
          <span class="language-pair"><Icon icon="mdi:translate" />{{ active.language.toUpperCase() }}<Icon icon="mdi:arrow-right" />{{ active.targetLanguage.toUpperCase() }}</span>
        </template>
      </KitPageHeader>
    </header>
    <div v-if="network.effectiveOffline" class="state-notice" role="status">
      <Icon icon="mdi:wifi-off" />{{ t('dictionary.bookDeckOffline') }}
    </div>
    <div v-if="store.state.error" class="state-notice error-notice" role="alert">
      <Icon icon="mdi:alert-circle-outline" />{{ store.state.error }}
    </div>
    <BookDeckLoader v-if="store.state.loading" />
    <div v-else-if="!active" class="loading-state">
      <Icon icon="mdi:book-alert-outline" /><KitBtn :disabled="busy || network.effectiveOffline" @click="store.open(bookId)">
        {{ t('bookDeck.retry') }}
      </KitBtn>
    </div>
    <template v-else>
      <ol v-if="step !== 'done'" class="workflow-steps" :aria-label="t('bookDeck.stepsLabel')">
        <li
          v-for="(stepName, index) in workflowSteps"
          :key="stepName"
          :class="{ current: step === stepName, complete: index < currentStepIndex }"
          :aria-current="step === stepName ? 'step' : undefined"
        >
          <span class="step-number"><Icon v-if="index < currentStepIndex" icon="mdi:check" /><template v-else>{{ index + 1 }}</template></span>
          <span>{{ t(`bookDeck.step${index + 1}`) }}</span>
        </li>
      </ol>
      <section v-if="step === 'done' || active.deckId" class="success-state" role="status">
        <span class="success-icon"><Icon icon="mdi:check-circle-outline" /></span>
        <h2>{{ t('bookDeck.savedTitle') }}</h2><p>{{ t('bookDeck.saved') }}</p>
        <div class="success-actions">
          <KitBtn append-icon="mdi:arrow-right" @click="goToDeck">
            {{ t('bookDeck.openDeck') }}
          </KitBtn><KitBtn variant="text" :disabled="busy || network.effectiveOffline" @click="createAnother">
            {{ t('bookDeck.another') }}
          </KitBtn>
        </div>
      </section>
      <div v-else class="workspace-grid">
        <div class="step-content">
          <template v-if="step === 'words'">
            <section class="control-panel">
              <div class="panel-heading">
                <span class="panel-symbol"><Icon icon="mdi:format-list-checks" /></span><div><h2>{{ t('bookDeck.chooseWordsTitle') }}</h2><p>{{ t('bookDeck.chooseWordsHint') }}</p></div>
              </div>
              <div class="word-filters">
                <label class="field search-field"><span>{{ t('bookDeck.searchLabel') }}</span><KitInput
                  v-model="filters.search"
                  :placeholder="t('bookDeck.search')"
                  prepend-icon="mdi:magnify"
                  clearable
                /></label>
                <div class="field">
                  <span>{{ t('bookDeck.dataColumn') }}</span><KitSelect v-model="filters.status" :options="wordStatusOptions" :aria-label="t('bookDeck.dataColumn')" />
                </div>
                <div class="frequency-range">
                  <label class="field"><span>{{ t('bookDeck.minFrequency') }}</span><KitInput v-model="filters.frequency" type="number" min="1" /></label>
                  <label class="field"><span>{{ t('bookDeck.maxFrequency') }}</span><KitInput
                    v-model="filters.maxFrequency"
                    type="number"
                    min="1"
                    :placeholder="t('bookDeck.noFrequencyLimit')"
                    clearable
                  /></label>
                </div>
              </div>
              <div class="selection-controls">
                <KitCheckbox v-model="filters.names" :label="t('bookDeck.includeNames')" /><div class="bulk-actions">
                  <KitBtn
                    variant="tonal"
                    size="sm"
                    :disabled="busy || !filteredWords.length"
                    @click="selectFiltered(true)"
                  >
                    {{ t('bookDeck.selectFiltered') }}
                  </KitBtn><KitBtn
                    variant="text"
                    size="sm"
                    :disabled="busy || !store.selected.size"
                    @click="selectFiltered(false)"
                  >
                    {{ t('bookDeck.deselectFiltered') }}
                  </KitBtn>
                </div>
              </div>
              <p class="selection-note">
                <Icon icon="mdi:information-outline" />{{ t('bookDeck.filterSelectionHint') }}
              </p>
            </section>
            <BookDeckWordList
              v-model:page="filters.page"
              :words="filteredWords"
              :selected="store.selected"
              :busy="busy"
              :errors="store.state.errors"
              @select="store.toggle"
            />
          </template>
          <template v-else-if="step === 'content'">
            <section class="control-panel">
              <div class="panel-heading">
                <span class="panel-symbol"><Icon :icon="missingCount ? 'mdi:creation' : 'mdi:check-decagram-outline'" /></span><div><h2>{{ t('bookDeck.prepareContentTitle') }}</h2><p>{{ t('bookDeck.prepareContentHint') }}</p></div>
              </div>
              <div v-if="missingCount" class="generation-card">
                <div class="generation-copy">
                  <strong>{{ t('bookDeck.missingCount', { count: missingCount }) }}</strong><span>{{ t('bookDeck.generateMissingHint') }}</span>
                </div><KitBtn
                  prepend-icon="mdi:creation"
                  :disabled="busy || network.effectiveOffline"
                  :loading="store.state.running"
                  @click="store.generate()"
                >
                  {{ t('bookDeck.generateMissingAction', { count: missingCount }) }}
                </KitBtn>
              </div>
              <div v-else class="ready-notice">
                <Icon icon="mdi:check-circle-outline" />{{ t('bookDeck.allReady') }}
              </div>
              <div v-if="store.state.total" class="generation-progress" role="status">
                <span>{{ t('bookDeck.progress', { done: store.state.done, total: store.state.total, word: store.state.current }) }}</span><progress :value="store.state.done" :max="store.state.total" :aria-label="t('bookDeck.generationProgress')" /><KitBtn
                  v-if="store.state.running"
                  variant="tonal"
                  :disabled="store.state.pause"
                  @click="store.state.pause = true"
                >
                  {{ t('bookDeck.pause') }}
                </KitBtn>
              </div>
              <div v-if="missingCount" class="skip-action">
                <KitBtn
                  variant="text"
                  size="sm"
                  :disabled="busy"
                  @click="removeMissing"
                >
                  {{ t('bookDeck.removeMissing', { count: missingCount }) }}
                </KitBtn>
              </div>
              <div class="review-filters">
                <label class="field"><span>{{ t('bookDeck.searchLabel') }}</span><KitInput
                  v-model="contentFilters.search"
                  :placeholder="t('bookDeck.searchSelected')"
                  prepend-icon="mdi:magnify"
                  clearable
                /></label><div class="field">
                  <span>{{ t('bookDeck.dataColumn') }}</span><KitSelect v-model="contentFilters.status" :options="contentStatusOptions" />
                </div>
              </div>
            </section>
            <BookDeckWordList
              v-model:page="contentFilters.page"
              :words="selectedFilteredWords"
              :selected="store.selected"
              :busy="busy"
              :current="store.state.current"
              :errors="store.state.errors"
              :offline="network.effectiveOffline"
              show-generate
              @select="store.toggle"
              @generate="generate"
            >
              {{ store.selected.size ? t('bookDeck.empty') : t('bookDeck.noSelectedWords') }}
            </BookDeckWordList>
            <p class="footnote">
              {{ t('bookDeck.draftHint') }}
            </p>
          </template>
          <BookDeckFilterPanel
            v-else-if="step === 'filter'"
            :words="active.words"
            :selected="store.selected"
            :busy="busy"
            :errors="store.state.errors"
            @select="store.toggle"
            @select-filtered="store.setSelected"
            @keep-filtered="store.keepSelected"
          />
          <section v-else class="control-panel save-panel">
            <div class="panel-heading">
              <span class="panel-symbol"><Icon icon="mdi:cards-outline" /></span><div><h2>{{ t('bookDeck.saveDeckTitle') }}</h2><p>{{ t('bookDeck.saveDeckHint') }}</p></div>
            </div>
            <label class="field deck-name-field"><span>{{ t('bookDeck.name') }}</span><KitInput
              v-model="name"
              :disabled="busy"
              maxlength="200"
              autofocus
            /></label>
            <div class="existing-card-setting" :inert="busy">
              <KitCheckbox v-model="updateExisting" :label="t('bookDeck.updateExisting')" /><p>{{ t('bookDeck.saveHint') }}</p>
            </div>
          </section>
        </div>
        <BookDeckSummary
          :selected="store.selected.size"
          :ready="readyCount"
          :missing="missingCount"
          :hint="t(step === 'words' ? 'bookDeck.selectionSummaryHint' : step === 'content' ? 'bookDeck.contentSummaryHint' : step === 'filter' ? 'bookDeck.filterSummaryHint' : missingCount ? 'bookDeck.missingSaveHint' : 'bookDeck.readySummaryHint')"
        >
          <KitBtn
            v-if="step === 'words'"
            append-icon="mdi:arrow-right"
            :disabled="busy || !store.selected.size"
            @click="setStep('content')"
          >
            {{ t('bookDeck.nextToContent') }}
          </KitBtn>
          <KitBtn
            v-else-if="step === 'content'"
            append-icon="mdi:arrow-right"
            :disabled="busy || !store.selected.size || missingCount > 0"
            @click="setStep('filter')"
          >
            {{ t('bookDeck.nextToFilters') }}
          </KitBtn>
          <KitBtn
            v-else-if="step === 'filter'"
            append-icon="mdi:arrow-right"
            :disabled="busy || !store.selected.size || missingCount > 0"
            @click="setStep('save')"
          >
            {{ t('bookDeck.nextToSave') }}
          </KitBtn>
          <KitBtn
            v-else
            prepend-icon="mdi:check"
            :disabled="busy || network.effectiveOffline || !name.trim() || !store.selected.size || missingCount > 0"
            :loading="store.state.saving"
            @click="store.save(name.trim(), updateExisting)"
          >
            {{ t('bookDeck.save') }}
          </KitBtn>
          <template #secondary>
            <KitBtn
              v-if="step !== 'words'"
              variant="text"
              :disabled="busy"
              @click="setStep(step === 'save' ? 'filter' : step === 'filter' ? 'content' : 'words')"
            >
              {{ t(step === 'save' ? 'bookDeck.backToFilters' : step === 'filter' ? 'bookDeck.backToContent' : 'bookDeck.backToWords') }}
            </KitBtn>
          </template>
        </BookDeckSummary>
      </div>
    </template>
    <KitDialog
      v-model:visible="confirmVisible"
      :title="t('bookDeck.regenerate')"
      :max-width="480"
      :z-index="1500"
      :minimizable="false"
    >
      <p>{{ t('bookDeck.regenerateConfirm', { word: replacement?.word }) }}</p>
      <template #footer>
        <div class="confirm-actions">
          <KitBtn variant="text" @click="confirmVisible = false">
            {{ t('dictionary.cancel') }}
          </KitBtn><KitBtn :disabled="busy || network.effectiveOffline" @click="regenerate">
            {{ t('bookDeck.generate') }}
          </KitBtn>
        </div>
      </template>
    </KitDialog>
  </section>
</template>

<style scoped lang="scss">
.book-deck-workspace {
  width: min(100%, 1440px);
  margin: 0 auto;
  padding: calc(28px + var(--safe-area-top)) 36px 48px;
  box-sizing: border-box;
}
.workspace-heading {
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-secondary-color);
}
.workspace-heading :deep(.kit-page-header-title h1) {
  font-size: 1.65rem;
  line-height: 1.3;
  margin-bottom: 5px;
}
.workspace-heading :deep(.kit-page-header-title p) {
  color: var(--fg-secondary-color);
  font-size: 0.86rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.language-pair {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 9px;
  font-size: 0.76rem;
  color: var(--fg-secondary-color);
}
.workflow-steps {
  display: flex;
  gap: 0;
  padding: 22px 0;
  margin: 0;
  list-style: none;
}
.workflow-steps li {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--fg-secondary-color);
  font-size: 0.83rem;
  transition: color 0.15s ease;
}
.workflow-steps li + li::before {
  content: '';
  width: 50px;
  height: 1px;
  margin: 0 18px;
  background: var(--border-secondary-color);
}
.step-number {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  place-items: center;
  border: 1px solid var(--border-primary-color);
  border-radius: 50%;
  font-size: 0.75rem;
}
.current {
  font-weight: 600;
  color: var(--fg-primary-color);
}
.current > span:last-child {
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--bg-accent-color);
}
.current .step-number {
  border-color: var(--fg-accent-color);
  background: var(--fg-accent-color);
  color: var(--bg-primary-color);
}
.complete .step-number {
  border-color: var(--fg-accent-color);
  background: color-mix(in srgb, var(--fg-accent-color) 10%, var(--bg-primary-color));
  color: var(--fg-accent-color);
}
.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 24px;
  align-items: start;
}
.step-content {
  min-width: 0;
  display: grid;
  gap: 18px;
}
.control-panel {
  min-width: 0;
  padding: 22px;
  border: 1px solid var(--bg-tertiary-color);
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-secondary-color) 72%, var(--bg-tertiary-color));
  display: grid;
  gap: 20px;
}
.panel-heading {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.panel-symbol {
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-accent-color);
  color: var(--fg-accent-color);
  font-size: 1.2rem;
}
.panel-heading h2 {
  font-size: 1.05rem;
  line-height: 1.4;
  margin: 0 0 5px;
  font-weight: 600;
}
.panel-heading p {
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.78rem;
  line-height: 1.7;
  max-width: 620px;
}
.word-filters {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(130px, 0.9fr) minmax(220px, 1fr);
  align-items: end;
  gap: 12px;
}
.frequency-range {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  min-width: 0;
}
.field {
  display: grid;
  min-width: 0;
  gap: 8px;
}
.field > span {
  color: var(--fg-secondary-color);
  font-size: 0.72rem;
  line-height: 1.5;
}
.field :deep(.kit-input-wrapper),
.field :deep(.kit-select-container) {
  min-width: 0;
  width: 100%;
}
.selection-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
}
.selection-controls :deep(.checkbox-label) {
  font-size: 0.77rem;
}
.selection-controls :deep(.kit-checkbox) {
  padding-left: 0;
}
.bulk-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.bulk-actions :deep(button) {
  font-size: 0.72rem;
  white-space: normal;
  height: auto;
  min-height: 34px;
}
.selection-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: var(--fg-secondary-color);
  font-size: 0.68rem;
  line-height: 1.7;
  margin: -6px 0 0;
}
.selection-note > :first-child {
  flex: 0 0 14px;
  margin-top: 3px;
}
.generation-card {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--bg-tertiary-color);
  border-radius: 12px;
  background: var(--bg-primary-color);
}
.generation-copy {
  display: grid;
  flex: 1 1 180px;
  gap: 7px;
}
.generation-copy strong {
  font-size: 0.9rem;
}
.generation-copy span {
  color: var(--fg-secondary-color);
  font-size: 0.73rem;
  line-height: 1.65;
}
.generation-card :deep(button) {
  white-space: normal;
  height: auto;
  min-height: 42px;
  font-size: 0.8rem;
}
.generation-progress {
  display: grid;
  gap: 10px;
  font-size: 0.76rem;
  color: var(--fg-secondary-color);
  overflow-wrap: anywhere;
}
.generation-progress progress {
  width: 100%;
  height: 6px;
  accent-color: var(--fg-accent-color);
}
.skip-action {
  margin-top: -12px;
}
.skip-action :deep(button) {
  white-space: normal;
  height: auto;
  min-height: 36px;
  font-size: 0.75rem;
  text-align: left;
}
.review-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 190px;
  align-items: end;
  gap: 12px;
}
.ready-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--fg-success-color) 35%, var(--border-secondary-color));
  background: var(--bg-success-color);
  color: var(--fg-success-color);
  font-size: 0.85rem;
}
.footnote {
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.7rem;
  line-height: 1.7;
}
.save-panel {
  gap: 26px;
}
.deck-name-field {
  max-width: 600px;
}
.existing-card-setting {
  display: grid;
  gap: 10px;
  padding: 18px;
  border: 1px solid var(--bg-tertiary-color);
  border-radius: 12px;
  background: var(--bg-primary-color);
}
.existing-card-setting :deep(.kit-checkbox) {
  align-items: flex-start;
  padding: 0;
}
.existing-card-setting :deep(.checkbox-label) {
  font-size: 0.83rem;
  line-height: 1.65;
}
.existing-card-setting :deep(.checkbox-box) {
  margin-top: 3px;
}
.existing-card-setting p {
  padding-left: 26px;
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.76rem;
  line-height: 1.75;
}
.state-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  margin-top: 20px;
  border: 1px solid var(--bg-tertiary-color);
  border-radius: 12px;
  background: var(--bg-secondary-color);
  font-size: 0.82rem;
  overflow-wrap: anywhere;
}
.error-notice {
  color: var(--text-error-color, #c33737);
}
.loading-state {
  display: grid;
  justify-items: center;
  gap: 20px;
  padding: 90px 24px;
  color: var(--fg-secondary-color);
  text-align: center;
}
.loading-state > :first-child {
  font-size: 2rem;
}
.loading-state h2 {
  font-size: 1rem;
  line-height: 1.7;
  font-weight: 500;
}
.success-state {
  display: grid;
  justify-items: center;
  gap: 14px;
  max-width: 660px;
  margin: 60px auto;
  padding: 40px;
  border: 1px solid var(--bg-tertiary-color);
  border-radius: 20px;
  background: var(--bg-secondary-color);
  text-align: center;
}
.success-icon {
  color: var(--fg-accent-color);
  font-size: 3.5rem;
}
.success-state h2 {
  margin: 0;
  font-size: 1.5rem;
}
.success-state p {
  margin: 0;
  color: var(--fg-secondary-color);
  line-height: 1.8;
  font-size: 0.88rem;
}
.success-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
}
.success-actions :deep(button) {
  white-space: normal;
  height: auto;
  min-height: 42px;
}
.confirm-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 1200px) {
  .book-deck-workspace {
    padding-inline: 24px;
  }
  .workspace-grid {
    grid-template-columns: minmax(0, 1fr) 260px;
    gap: 18px;
  }
  .control-panel {
    padding: 18px;
  }
}
@media (max-width: 960px) {
  .workspace-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .book-deck-workspace {
    padding-bottom: calc(150px + env(safe-area-inset-bottom, 0px));
  }
  .word-filters {
    grid-template-columns: minmax(0, 1.3fr) minmax(130px, 0.9fr) minmax(220px, 1fr);
  }
}
@media (max-width: 680px) {
  .book-deck-workspace {
    padding: calc(18px + var(--safe-area-top)) 12px calc(150px + env(safe-area-inset-bottom, 0px));
  }
  .workspace-heading {
    padding-bottom: 18px;
  }
  .workspace-heading :deep(.kit-page-header) {
    align-items: flex-start;
  }
  .workspace-heading :deep(.kit-page-header-title h1) {
    font-size: 1.2rem;
  }
  .workspace-heading :deep(.kit-page-header-title p) {
    display: block;
    font-size: 0.73rem;
  }
  .language-pair {
    padding: 6px;
    gap: 4px;
    font-size: 0.62rem;
  }
  .language-pair > :first-child {
    display: none;
  }
  .workflow-steps {
    padding-block: 18px;
    justify-content: space-between;
  }
  .workflow-steps li {
    gap: 6px;
    font-size: 0.7rem;
  }
  .workflow-steps li + li::before {
    display: none;
  }
  .step-number {
    width: 23px;
    height: 23px;
    flex-basis: 23px;
    font-size: 0.65rem;
  }
  .control-panel {
    padding: 16px;
    gap: 16px;
  }
  .panel-symbol {
    display: none;
  }
  .panel-heading h2 {
    font-size: 0.95rem;
  }
  .panel-heading p {
    font-size: 0.72rem;
  }
  .word-filters {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .search-field {
    grid-column: 1 / -1;
  }
  .selection-controls {
    align-items: stretch;
    gap: 10px;
  }
  .bulk-actions {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .bulk-actions :deep(button) {
    font-size: 0.68rem;
    min-height: 38px;
    padding-inline: 8px;
  }
  .selection-note {
    font-size: 0.65rem;
  }
  .review-filters {
    grid-template-columns: minmax(0, 1fr);
  }
  .generation-card {
    padding: 14px;
    gap: 12px;
  }
  .generation-card :deep(button) {
    width: 100%;
  }
  .existing-card-setting {
    padding: 14px;
  }
  .success-state {
    margin: 28px auto;
    padding: 28px 18px;
  }
}
</style>
