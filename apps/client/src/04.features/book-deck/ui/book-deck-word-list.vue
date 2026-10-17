<script setup lang="ts">
import type { BookDeckWord } from '~/01.shared/types/schemas/book-deck.schema'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'
import BookDeckPagination from './book-deck-pagination.vue'
import BookDeckWordDetails from './book-deck-word-details.vue'
import BookDeckWordRow from './book-deck-word.vue'

interface Props {
  words: BookDeckWord[]
  selected: Set<string>
  busy: boolean
  current?: string
  errors: Record<string, string>
  showGenerate?: boolean
  offline?: boolean
}

const props = withDefaults(defineProps<Props>(), { showGenerate: false, current: '', offline: false })
const emit = defineEmits<{ select: [word: string, checked: boolean], generate: [word: BookDeckWord] }>()
const page = defineModel<number>('page', { required: true })

const { t } = useI18n()
const browserRef = useTemplateRef<HTMLElement>('browserRef')

const inspectedWord = ref<BookDeckWord | null>(null)
const inspectorVisible = ref(false)
const pageSize = 50

const pageCount = computed(() => Math.max(1, Math.ceil(props.words.length / pageSize)))
const pageWords = computed(() => props.words.slice(page.value * pageSize, (page.value + 1) * pageSize))
const allSelected = computed(() => pageWords.value.length > 0 && pageWords.value.every(word => props.selected.has(word.word)))

watch(pageCount, (count) => {
  page.value = Math.min(Math.max(page.value, 0), count - 1)
}, { immediate: true, flush: 'sync' })
watch(page, () => browserRef.value?.scrollIntoView?.({ block: 'start' }))

function inspect(word: BookDeckWord) {
  inspectedWord.value = word
  inspectorVisible.value = true
}
function selectPage(checked: boolean) {
  if (!props.busy)
    pageWords.value.forEach(word => emit('select', word.word, checked))
}
</script>

<template>
  <section ref="browserRef" class="word-browser">
    <div class="list-topbar">
      <div class="list-selection" :inert="busy">
        <KitCheckbox
          v-if="!showGenerate && words.length"
          :model-value="allSelected"
          :label="t('bookDeck.selectPage')"
          @update:model-value="selectPage(!!$event)"
        />
        <span class="result-count">{{ t('bookDeck.resultsCount', { count: words.length }) }}</span>
      </div>
      <BookDeckPagination v-if="pageCount > 1" v-model="page" :page-count="pageCount" />
    </div>
    <div v-if="$slots.tools" class="list-tools" :inert="busy">
      <slot name="tools" />
    </div>
    <div v-if="words.length" class="list-columns" aria-hidden="true">
      <span>{{ t('bookDeck.wordColumn') }}</span><span>{{ t('bookDeck.translationColumn') }}</span><span class="count-column">{{ t('bookDeck.frequencyColumn') }}</span><span>{{ t('bookDeck.dataColumn') }}</span><span />
    </div>
    <div class="words-list" :aria-busy="busy">
      <BookDeckWordRow
        v-for="word in pageWords"
        :key="word.word"
        :entry="word"
        :selected="selected.has(word.word)"
        :busy="busy"
        :current="current === word.word"
        :error="errors[word.word]"
        :show-generate="showGenerate"
        :offline="offline"
        @select="emit('select', word.word, $event)"
        @generate="emit('generate', word)"
        @inspect="inspect(word)"
      />
      <p v-if="!words.length" class="empty-list">
        <slot>{{ t('bookDeck.empty') }}</slot>
      </p>
    </div>
    <div v-if="pageCount > 1" class="list-bottom">
      <BookDeckPagination v-model="page" :page-count="pageCount" />
    </div>
    <BookDeckWordDetails
      v-if="inspectedWord"
      v-model:visible="inspectorVisible"
      :entry="inspectedWord"
      :busy="busy"
      :offline="offline"
      :show-generate="showGenerate"
      :current="current"
      @generate="emit('generate', inspectedWord)"
    />
  </section>
</template>

<style scoped lang="scss">
.word-browser {
  min-width: 0;
  border: 1px solid var(--border-secondary-color);
  border-radius: 16px;
  overflow: hidden;
  scroll-margin-top: 20px;
  background: var(--bg-primary-color);
}
.list-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
}
.list-selection {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
}
.list-selection :deep(.checkbox-label) {
  font-size: 0.78rem;
}
.result-count {
  color: var(--fg-secondary-color);
  font-size: 0.72rem;
}
.list-tools {
  padding: 10px 18px;
  border-bottom: 1px solid var(--border-secondary-color);
}
.list-columns {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(140px, 1.5fr) 66px 132px 76px;
  gap: 12px;
  padding: 10px 18px;
  background: var(--bg-tertiary-color);
  border-bottom: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  font-size: 0.66rem;
}
.count-column {
  text-align: right;
}
.list-bottom {
  padding: 10px 18px;
  border-top: 1px solid var(--border-secondary-color);
}
.empty-list {
  margin: 0;
  padding: 48px 24px;
  color: var(--fg-secondary-color);
  text-align: center;
  line-height: 1.7;
}
@media (max-width: 1200px) and (min-width: 961px) {
  .list-columns {
    grid-template-columns: minmax(100px, 1fr) minmax(100px, 1.2fr) 50px 100px 70px;
    gap: 8px;
    padding-inline: 14px;
  }
}
@media (max-width: 680px) {
  .list-columns {
    display: none;
  }
  .list-topbar {
    padding: 10px 14px;
  }
  .list-selection {
    gap: 6px;
  }
}
</style>
