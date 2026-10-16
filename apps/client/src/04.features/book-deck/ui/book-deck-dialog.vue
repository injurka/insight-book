<script setup lang="ts">
import type { BookDeckWord } from '~/01.shared/types/schemas/book-deck.schema'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'
import { useBookDeckStore } from '../store/book-deck.store'
import BookDeckWordRow from './book-deck-word.vue'

interface Props { bookId: number }

const props = defineProps<Props>()
const visible = defineModel<boolean>('visible', { required: true })

const store = useBookDeckStore()
const { t } = useI18n()
const router = useRouter()

const filters = reactive({
  search: '',
  status: 'all',
  names: false,
  frequency: 1,
  page: 0,
})
const name = ref('')
const updateExisting = ref(false)
const replacement = ref<BookDeckWord | null>(null)

const confirmVisible = computed({
  get: () => !!replacement.value,
  set: (value) => {
    if (!value)
      replacement.value = null
  },
})
const busy = computed(() => store.state.loading || store.state.running || store.state.saving)
const active = computed(() => store.draft?.bookId === props.bookId ? store.draft : null)
const filtered = computed(() => active.value?.words.filter(w =>
  (filters.names || !w.properName)
  && w.count >= (Number(filters.frequency) || 1)
  && w.word.includes(String(filters.search).toLowerCase())
  && (filters.status === 'all' || (filters.status === 'missing' ? !w.content : filters.status === 'selected' ? store.selected.has(w.word) : w.source === filters.status))) || [])
const pageWords = computed(() => filtered.value.slice(filters.page * 50, (filters.page + 1) * 50))
const statusOptions = computed(() => ['all', 'selected', 'dictionary', 'cache', 'missing', 'generated'].map(value => ({ value, label: t(`bookDeck.${value}`) })))

watch(() => [visible.value, props.bookId], () => {
  if (visible.value)
    store.open(props.bookId)
}, { immediate: true })
watch(() => store.draft?.id, () => {
  name.value = store.draft?.name || ''
  updateExisting.value = false
  filters.page = 0
}, { immediate: true })
watch(() => [filters.search, filters.status, filters.names, filters.frequency], () => {
  filters.page = 0
})
watch(visible, (value) => {
  if (!value)
    store.state.pause = true
})

function generate(word: BookDeckWord) {
  if (word.content)
    replacement.value = word
  else store.generate([word])
}
function regenerate() {
  const word = replacement.value
  replacement.value = null

  if (word)
    store.generate([word])
}
function goToDeck() {
  visible.value = false
  router.push({ path: AppRoutePaths.Dictionary, query: { deck: active.value?.deckId } })
}

onUnmounted(() => {
  store.state.pause = true
})
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="t('bookDeck.title')"
    :max-width="900"
    :persistent="store.state.saving"
  >
    <p>{{ t('bookDeck.description') }}</p>
    <p v-if="store.state.loading" role="status">
      {{ t('bookDeck.scanning') }}
    </p>
    <p v-if="store.state.error" role="alert">
      {{ store.state.error }}
    </p>
    <KitBtn v-if="!active && !store.state.loading" @click="store.open(bookId)">
      {{ t('bookDeck.retry') }}
    </KitBtn>
    <div v-if="active && !store.state.loading" class="master">
      <template v-if="active.deckId">
        <p role="status">
          {{ t('bookDeck.saved') }}
        </p>
        <KitBtn @click="goToDeck">
          {{ t('bookDeck.openDeck') }}
        </KitBtn>
        <KitBtn variant="text" @click="store.open(bookId, true)">
          {{ t('bookDeck.another') }}
        </KitBtn>
      </template>
      <template v-else>
        <label>{{ t('bookDeck.name') }}<KitInput v-model="name" :disabled="busy" maxlength="200" /></label>
        <p role="status">
          {{ t('bookDeck.summary', { total: active.words.length, selected: store.selected.size, pending: store.pending.length }) }}
        </p>
        <div class="filters">
          <KitInput v-model="filters.search" :placeholder="t('bookDeck.search')" />
          <KitSelect v-model="filters.status" :options="statusOptions" />
          <label>{{ t('bookDeck.minFrequency') }}<KitInput v-model="filters.frequency" type="number" /></label>
          <KitCheckbox v-model="filters.names" :label="t('bookDeck.includeNames')" />
        </div>
        <div class="actions">
          <KitBtn variant="text" :disabled="busy" @click="filtered.forEach(w => store.toggle(w.word, true))">
            {{ t('bookDeck.selectFiltered') }}
          </KitBtn>
          <KitBtn variant="text" :disabled="busy" @click="filtered.forEach(w => store.toggle(w.word, false))">
            {{ t('bookDeck.deselectFiltered') }}
          </KitBtn>
          <KitBtn :disabled="busy || !store.selectedWords.some(w => !w.content)" @click="store.generate()">
            {{ t('bookDeck.generateMissing') }}
          </KitBtn>
          <KitBtn v-if="store.state.running" variant="outlined" @click="store.state.pause = true">
            {{ t('bookDeck.pause') }}
          </KitBtn>
        </div>
        <p v-if="store.state.total" role="status">
          {{ t('bookDeck.progress', { done: store.state.done, total: store.state.total, word: store.state.current }) }}
        </p>
        <p>{{ t('bookDeck.draftHint') }}</p>
        <div class="words" :aria-busy="store.state.running">
          <BookDeckWordRow
            v-for="word in pageWords"
            :key="word.word"
            :entry="word"
            :selected="store.selected.has(word.word)"
            :busy="busy"
            :current="store.state.current === word.word"
            :error="store.state.errors[word.word]"
            @select="store.toggle(word.word, $event)"
            @generate="generate(word)"
          />
          <p v-if="!filtered.length">
            {{ t('bookDeck.empty') }}
          </p>
        </div>
        <div class="actions">
          <KitBtn variant="text" :disabled="filters.page === 0" @click="filters.page--">
            {{ t('bookDeck.previous') }}
          </KitBtn>
          <span>{{ filters.page + 1 }} / {{ Math.max(1, Math.ceil(filtered.length / 50)) }}</span>
          <KitBtn variant="text" :disabled="(filters.page + 1) * 50 >= filtered.length" @click="filters.page++">
            {{ t('bookDeck.next') }}
          </KitBtn>
        </div>
        <KitCheckbox v-model="updateExisting" :label="t('bookDeck.updateExisting')" />
        <p>{{ t('bookDeck.saveHint') }}</p>
        <KitBtn :disabled="busy || !name.trim() || !store.selected.size || !!store.pending.length" :loading="store.state.saving" @click="store.save(name, updateExisting)">
          {{ t('bookDeck.save') }}
        </KitBtn>
      </template>
    </div>
    <KitDialog v-model:visible="confirmVisible" :title="t('bookDeck.regenerate')">
      <p>{{ t('bookDeck.regenerateConfirm', { word: replacement?.word }) }}</p>
      <KitBtn @click="regenerate">
        {{ t('bookDeck.generate') }}
      </KitBtn>
    </KitDialog>
  </KitDialog>
</template>

<style scoped lang="scss">
.master {
  display: grid;
  gap: 12px;
}
.filters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: center;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.words {
  max-height: 52vh;
  overflow-y: auto;
}
label {
  display: grid;
  gap: 6px;
}
@media (max-width: 600px) {
  .filters {
    grid-template-columns: 1fr;
  }
}
</style>
