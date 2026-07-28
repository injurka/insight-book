<script setup lang="ts">
import type { SelectOption } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitSelect } from '~/components/01.kit'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { pluginManager } from '~/shared/plugins/plugin-manager'
import { useDictionaryStore } from '../../../store/dictionary.store'

defineOptions({
  inheritAttrs: false,
})

const emit = defineEmits(['start', 'close'])

const customTrainingModes = computed(() => pluginManager.getWidgets('dictionary:training-modes'))

const dictStore = useDictionaryStore()
const { t } = useI18n()

const setupOptions = reactive({
  deckId: (Array.isArray(dictStore.selectedDeckId) ? (dictStore.selectedDeckId.length === 1 ? dictStore.selectedDeckId[0] : 'all') : dictStore.selectedDeckId) as number | 'all' | 'none',
  difficulty: (Array.isArray(dictStore.selectedDifficulty) ? [...dictStore.selectedDifficulty] : [dictStore.selectedDifficulty]) as string[],
})

const modes = reactive({
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

watch(() => dictStore.trainingMode, (mode) => {
  if (mode === 'deep_dive') {
    modes.standard = false
    modes.audio = false
    modes.writing = false
    modes.typing = false
    modes.choice = false
    modes['choice-reverse'] = false
    modes.scramble = false
    modes.collocations = false
    modes.radicals = false
  }
  else {
    modes.standard = false
    modes.audio = false
    modes.writing = false
    modes.typing = false
    modes.choice = false
    modes['choice-reverse'] = false
    modes.scramble = false
    modes.collocations = false
    modes.radicals = false
  }
}, { immediate: true })

watch(showWritingMode, (newVal) => {
  if (!newVal) {
    modes.writing = false
    modes.radicals = false
  }
}, { immediate: true })

const deckOptions = computed(() => {
  const opts: SelectOption[] = [
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
  const opts: SelectOption[] = [{ label: t('dictionary.allDifficulties'), value: 'all' }, { label: t('dictionary.noDifficulty'), value: 'none' }]
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
  setupOptions.difficulty = setupOptions.difficulty.filter(d => newOpts.some(o => o.value === d))
  if (setupOptions.difficulty.length === 0) {
    setupOptions.difficulty = ['all']
  }
})

function start() {
  const selectedModes = { ...modes }
  if (dictStore.trainingMode === 'match') {
    emit('start', { ...setupOptions, modes: selectedModes })
    return
  }
  if (!selectedModes.standard && !selectedModes.audio && !selectedModes.writing && !selectedModes.typing && !selectedModes.choice && !selectedModes['choice-reverse'] && !selectedModes.scramble && !selectedModes.collocations && !selectedModes.radicals) {
    if (dictStore.trainingMode === 'deep_dive') {
      selectedModes.scramble = true
    }
    else {
      selectedModes.standard = true
    }
  }
  emit('start', { ...setupOptions, modes: selectedModes })
}
</script>

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
          <KitSelect v-model="setupOptions.difficulty" :options="difficultyOptions" multiple />
        </div>
      </div>
    </div>

    <div class="settings-group">
      <label class="group-label">{{ t('dictionary.trainingModes') }}</label>

      <div v-if="dictStore.trainingMode === 'match'" class="empty-modes-message">
        {{ t('dictionary.noExtraModesForMatch') }}
      </div>
      <div v-else class="modes-grid">
        <template v-if="dictStore.trainingMode !== 'deep_dive'">
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
          <div class="mode-card" :class="{ 'is-active': modes.choice }" @click="modes.choice = !modes.choice">
            <Icon icon="mdi:format-list-checks" class="mode-icon" />
            <span class="mode-title">{{ t('dictionary.test') }}</span>
            <span class="mode-desc">{{ t('dictionary.multipleChoice') }}</span>
          </div>
          <div class="mode-card" :class="{ 'is-active': modes['choice-reverse'] }" @click="modes['choice-reverse'] = !modes['choice-reverse']">
            <Icon icon="mdi:format-list-checks" class="mode-icon flipped" />
            <span class="mode-title">Обратный тест</span>
            <span class="mode-desc">Вспомнить слово по переводу</span>
          </div>
          <div class="mode-card" :class="{ 'is-active': modes.audio }" @click="modes.audio = !modes.audio">
            <Icon icon="mdi:headphones" class="mode-icon" />
            <span class="mode-title">{{ t('dictionary.listening') }}</span>
            <span class="mode-desc">{{ t('dictionary.aiSpeech') }}</span>
          </div>
          <div
            v-if="showWritingMode"
            class="mode-card"
            :class="{ 'is-active': modes.writing }"
            @click="modes.writing = !modes.writing"
          >
            <Icon icon="mdi:draw" class="mode-icon" />
            <span class="mode-title">{{ t('dictionary.writing') }}</span>
            <span class="mode-desc">{{ t('dictionary.hanziByMemory') }}</span>
          </div>
        </template>
        <template v-else>
          <div class="mode-card" :class="{ 'is-active': modes.scramble }" @click="modes.scramble = !modes.scramble">
            <Icon icon="mdi:puzzle-outline" class="mode-icon" />
            <span class="mode-title">{{ t('dictionary.scramble') }}</span>
            <span class="mode-desc">{{ t('dictionary.scrambleDesc') }}</span>
          </div>
          <div class="mode-card" :class="{ 'is-active': modes.collocations }" @click="modes.collocations = !modes.collocations">
            <Icon icon="mdi:link-variant" class="mode-icon" />
            <span class="mode-title">{{ t('dictionary.collocations') }}</span>
            <span class="mode-desc">{{ t('dictionary.collocationsDesc') }}</span>
          </div>
          <div
            v-if="showWritingMode"
            class="mode-card"
            :class="{ 'is-active': modes.radicals }"
            @click="modes.radicals = !modes.radicals"
          >
            <Icon icon="mdi:format-annotation-plus" class="mode-icon" />
            <span class="mode-title">{{ t('dictionary.radicals') }}</span>
            <span class="mode-desc">{{ t('dictionary.radicalsDesc') }}</span>
          </div>
        </template>

        <!-- Dynamic plugin training mode widgets -->
        <component
          :is="widget.component"
          v-for="widget in customTrainingModes"
          :key="widget.id"
          v-bind="widget.props"
        />
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

    .empty-modes-message {
      color: var(--fg-secondary-color);
      font-size: 0.9rem;
      padding: 12px 0;
      text-align: center;
      border-radius: 12px;
    }

    .modes-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);

      @include media-down(sm) {
        grid-template-columns: repeat(2, 1fr);
      }
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

          &.flipped {
            transform: scaleX(-1);
          }
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
