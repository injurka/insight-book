<script setup lang="ts">
import type { BookDeckWord } from '~/01.shared/types/schemas/book-deck.schema'
import { Icon } from '@iconify/vue'
import { isWordContentComplete } from '@injurka/insight-book-language-utils'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { POS_TAGS_MAP } from '~/01.shared/constants/pos-tags'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import BookDeckWordList from './book-deck-word-list.vue'

interface Props {
  words: BookDeckWord[]
  selected: Set<string>
  busy: boolean
  errors: Record<string, string>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  select: [word: string, checked: boolean]
  selectFiltered: [words: string[], checked: boolean]
  keepFiltered: [words: string[]]
}>()

const { t } = useI18n()

const page = ref(0)
const filters = reactive({
  search: '',
  difficulty: ['all'],
  partOfSpeech: ['all'],
  themes: ['all'],
  source: 'all',
  includeNames: false,
  minFrequency: 1,
  maxFrequency: null as number | null,
  sort: 'frequency',
})
const sortComparators: Record<string, (a: BookDeckWord, b: BookDeckWord) => number> = {
  frequency: (a, b) => b.count - a.count || a.word.localeCompare(b.word),
  frequencyAsc: (a, b) => a.count - b.count || a.word.localeCompare(b.word),
  difficulty: compareDifficulty,
  difficultyDesc: (a, b) => compareDifficulty(b, a),
  alphabetical: (a, b) => a.word.localeCompare(b.word),
  length: (a, b) => a.word.length - b.word.length || a.word.localeCompare(b.word),
}

const readyWords = computed(() => props.words.filter(word => isWordContentComplete(word.content)))
const difficulties = computed(() => [...new Set(readyWords.value.map(word => word.content?.difficulty.trim()).filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
const partsOfSpeech = computed(() => [...new Set(readyWords.value.map(word => word.pos || 'unk'))].sort((a, b) => a.localeCompare(b)))
const themes = computed(() => [...new Set(readyWords.value.flatMap(word => parseTags(word.content?.tags)))].sort((a, b) => a.localeCompare(b)))
const difficultyOptions = computed(() => [
  { value: 'all', label: t('bookDeck.filterAll') },
  ...difficulties.value.map(value => ({ value, label: value })),
])
const partOfSpeechOptions = computed(() => [
  { value: 'all', label: t('bookDeck.filterAll') },
  ...partsOfSpeech.value.map(value => ({ value, label: POS_TAGS_MAP[value] ? t(POS_TAGS_MAP[value]) : value })),
])
const themeOptions = computed(() => [
  { value: 'all', label: t('bookDeck.filterAll') },
  ...themes.value.map(value => ({ value, label: value })),
])
const sourceOptions = computed(() => [
  { value: 'all', label: t('bookDeck.filterAll') },
  ...(['dictionary', 'cache', 'generated'] as const).map(value => ({ value, label: t(`bookDeck.${value}`) })),
])
const sortOptions = computed(() => [
  { value: 'frequency', label: t('bookDeck.sortFrequency') },
  { value: 'frequencyAsc', label: t('bookDeck.sortRareFirst') },
  { value: 'difficulty', label: t('bookDeck.sortDifficulty') },
  { value: 'difficultyDesc', label: t('bookDeck.sortDifficultyDesc') },
  { value: 'alphabetical', label: t('bookDeck.sortAlphabetical') },
  { value: 'length', label: t('bookDeck.sortLength') },
])
const filteredWords = computed(() => readyWords.value
  .filter(matchesFilters)
  .slice()
  .sort(compareWords))
const selectedCount = computed(() => props.selected.size)
const incompleteCount = computed(() => props.words.length - readyWords.value.length)
const visibleSelectedCount = computed(() => filteredWords.value.reduce((count, word) => count + Number(props.selected.has(word.word)), 0))

watch(filters, () => {
  page.value = 0
}, { deep: true })

function parseTags(value?: string) {
  return value?.split(/[,;|\n]/u).map(tag => tag.trim()).filter(Boolean) || []
}
function matchesSelected(values: string[], value?: string) {
  return values.includes('all') || (value !== undefined && values.includes(value))
}
function matchesFilters(word: BookDeckWord) {
  return [
    matchesSearch(word),
    matchesDifficulty(word),
    matchesPartOfSpeech(word),
    matchesTheme(word),
    matchesSource(word),
    matchesFrequency(word),
    matchesName(word),
  ].every(Boolean)
}
function compareWords(a: BookDeckWord, b: BookDeckWord) {
  return sortComparators[filters.sort]?.(a, b) || sortComparators.frequency(a, b)
}
function matchesSearch(word: BookDeckWord) {
  const search = filters.search.trim().toLocaleLowerCase()

  return !search || word.word.toLocaleLowerCase().includes(search)
}
function matchesDifficulty(word: BookDeckWord) {
  return matchesSelected(filters.difficulty, word.content?.difficulty.trim())
}
function matchesPartOfSpeech(word: BookDeckWord) {
  return matchesSelected(filters.partOfSpeech, word.pos || 'unk')
}
function matchesTheme(word: BookDeckWord) {
  return filters.themes.includes('all') || parseTags(word.content?.tags).some(tag => filters.themes.includes(tag))
}
function matchesSource(word: BookDeckWord) {
  return filters.source === 'all' || word.source === filters.source
}
function matchesFrequency(word: BookDeckWord) {
  const minimum = Math.max(1, Number(filters.minFrequency) || 1)
  const maximum = filters.maxFrequency === null ? null : Number(filters.maxFrequency)

  return word.count >= minimum && (maximum === null || word.count <= maximum)
}
function matchesName(word: BookDeckWord) {
  return filters.includeNames || !word.properName
}
function compareDifficulty(a: BookDeckWord, b: BookDeckWord) {
  const difficultyA = a.content?.difficulty || ''
  const difficultyB = b.content?.difficulty || ''

  return difficultyA.localeCompare(difficultyB, undefined, { numeric: true }) || a.word.localeCompare(b.word)
}
function resetFilters() {
  filters.search = ''
  filters.difficulty = ['all']
  filters.partOfSpeech = ['all']
  filters.themes = ['all']
  filters.source = 'all'
  filters.includeNames = false
  filters.minFrequency = 1
  filters.maxFrequency = null
  filters.sort = 'frequency'
}
function selectFiltered(checked: boolean) {
  emit('selectFiltered', filteredWords.value.map(word => word.word), checked)
}
function keepFiltered() {
  emit('keepFiltered', filteredWords.value.map(word => word.word))
}
</script>

<template>
  <section class="control-panel filter-panel">
    <div class="panel-heading">
      <span class="panel-symbol"><Icon icon="mdi:filter-variant" /></span>
      <div>
        <h2>{{ t('bookDeck.filterDeckTitle') }}</h2>
        <p>{{ t('bookDeck.filterDeckHint') }}</p>
      </div>
    </div>

    <div class="filter-fields">
      <label class="field search-field">
        <span>{{ t('bookDeck.searchLabel') }}</span>
        <KitInput
          v-model="filters.search"
          :placeholder="t('bookDeck.search')"
          prepend-icon="mdi:magnify"
          clearable
        />
      </label>
      <div class="field">
        <span>{{ t('bookDeck.difficultyFilter') }}</span>
        <KitSelect
          v-model="filters.difficulty"
          :options="difficultyOptions"
          :aria-label="t('bookDeck.difficultyFilter')"
          multiple
        />
      </div>
      <div class="field">
        <span>{{ t('bookDeck.partOfSpeechFilter') }}</span>
        <KitSelect
          v-model="filters.partOfSpeech"
          :options="partOfSpeechOptions"
          :aria-label="t('bookDeck.partOfSpeechFilter')"
          multiple
        />
      </div>
      <div v-if="themes.length" class="field">
        <span>{{ t('bookDeck.themeFilter') }}</span>
        <KitSelect
          v-model="filters.themes"
          :options="themeOptions"
          :aria-label="t('bookDeck.themeFilter')"
          multiple
        />
      </div>
      <div v-else class="field unavailable-filter">
        <span>{{ t('bookDeck.themeFilter') }}</span>
        <p>{{ t('bookDeck.noThemeTags') }}</p>
      </div>
      <div class="field">
        <span>{{ t('bookDeck.sourceFilter') }}</span>
        <KitSelect v-model="filters.source" :options="sourceOptions" :aria-label="t('bookDeck.sourceFilter')" />
      </div>
      <div class="field">
        <span>{{ t('bookDeck.sortWords') }}</span>
        <KitSelect v-model="filters.sort" :options="sortOptions" :aria-label="t('bookDeck.sortWords')" />
      </div>
      <div class="frequency-range">
        <label class="field">
          <span>{{ t('bookDeck.minFrequency') }}</span>
          <KitInput v-model="filters.minFrequency" type="number" min="1" />
        </label>
        <label class="field">
          <span>{{ t('bookDeck.maxFrequency') }}</span>
          <KitInput
            v-model="filters.maxFrequency"
            type="number"
            min="1"
            :placeholder="t('bookDeck.noFrequencyLimit')"
            clearable
          />
        </label>
      </div>
    </div>

    <div class="filter-footer">
      <KitCheckbox v-model="filters.includeNames" :label="t('bookDeck.includeNames')" />
      <KitBtn
        variant="text"
        size="sm"
        prepend-icon="mdi:refresh"
        @click="resetFilters"
      >
        {{ t('bookDeck.resetFilters') }}
      </KitBtn>
    </div>

    <div class="filter-feedback" role="status" aria-live="polite">
      <div class="filter-stat">
        <strong>{{ filteredWords.length }}</strong><span>{{ t('bookDeck.filterMatchesLabel') }}</span>
      </div>
      <div class="filter-stat">
        <strong>{{ selectedCount }}</strong><span>{{ t('bookDeck.filterSelectedLabel', { total: readyWords.length }) }}</span>
      </div>
      <div class="filter-stat">
        <strong>{{ visibleSelectedCount }}</strong><span>{{ t('bookDeck.filterSelectedMatchesLabel') }}</span>
      </div>
    </div>

    <p class="filter-note">
      <Icon icon="mdi:information-outline" />
      <span>{{ t('bookDeck.filterLogicHint') }}</span>
    </p>
    <p v-if="incompleteCount" class="filter-note incomplete-note">
      <Icon icon="mdi:alert-circle-outline" />
      <span>{{ t('bookDeck.filterIncompleteHint', { count: incompleteCount }) }}</span>
    </p>

    <div class="filter-actions">
      <KitBtn
        variant="tonal"
        size="sm"
        :disabled="busy || !filteredWords.length"
        @click="selectFiltered(true)"
      >
        {{ t('bookDeck.selectFiltered') }}
      </KitBtn>
      <KitBtn
        variant="text"
        size="sm"
        :disabled="busy || !visibleSelectedCount"
        @click="selectFiltered(false)"
      >
        {{ t('bookDeck.deselectFiltered') }}
      </KitBtn>
      <KitBtn
        variant="text"
        size="sm"
        :disabled="busy || !filteredWords.length"
        @click="keepFiltered"
      >
        {{ t('bookDeck.onlyFiltered', { count: filteredWords.length }) }}
      </KitBtn>
    </div>

    <BookDeckWordList
      v-model:page="page"
      :words="filteredWords"
      :selected="selected"
      :busy="busy"
      :errors="errors"
      @select="(word, checked) => emit('select', word, checked)"
    />
  </section>
</template>

<style scoped lang="scss">
.filter-panel {
  gap: 18px;
}
.panel-heading {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.panel-symbol {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--fg-accent-color) 20%, transparent);
  background: var(--bg-accent-color);
  color: var(--fg-accent-color);
  font-size: 1.3rem;
}
.panel-heading h2 {
  margin: 0 0 6px;
  font-size: 1.08rem;
  line-height: 1.45;
}
.panel-heading p {
  max-width: 760px;
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.8rem;
  line-height: 1.7;
}
.filter-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: end;
  gap: 16px;
}
.field {
  display: grid;
  gap: 7px;
  min-width: 0;
  color: var(--fg-secondary-color);
  font-size: 0.75rem;
}
.unavailable-filter p {
  min-height: 38px;
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0 12px;
  border: 1px dashed var(--border-secondary-color);
  border-radius: 6px;
  color: var(--fg-secondary-color);
  font-size: 0.72rem;
}
.search-field {
  grid-column: span 2;
}
.frequency-range {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.filter-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.filter-feedback {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.filter-stat {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 10px;
  background: var(--bg-primary-color);
}
.filter-stat:first-child {
  border-color: color-mix(in srgb, var(--fg-accent-color) 28%, var(--border-secondary-color));
  background: var(--bg-accent-color);
}
.filter-stat strong {
  font-size: 1.05rem;
  line-height: 1.3;
}
.filter-stat span {
  color: var(--fg-secondary-color);
  font-size: 0.7rem;
  line-height: 1.45;
}
.filter-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.72rem;
  line-height: 1.65;
}
.filter-note > :first-child {
  flex: 0 0 15px;
  margin-top: 2px;
}
.incomplete-note {
  color: var(--fg-warning-color, var(--fg-secondary-color));
}
.filter-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  padding: 8px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 10px;
  background: var(--bg-primary-color);
}
@media (max-width: 900px) {
  .filter-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .panel-heading {
    gap: 12px;
  }
  .panel-symbol {
    display: none;
  }
  .filter-fields {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .search-field {
    grid-column: auto;
  }
  .filter-feedback {
    gap: 6px;
  }
  .filter-stat {
    padding: 9px;
  }
  .filter-stat strong {
    font-size: 0.9rem;
  }
  .filter-stat span {
    font-size: 0.62rem;
  }
  .filter-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .filter-actions :deep(button) {
    justify-content: flex-start;
    white-space: normal;
    min-height: 38px;
    height: auto;
    text-align: left;
  }
}
</style>
