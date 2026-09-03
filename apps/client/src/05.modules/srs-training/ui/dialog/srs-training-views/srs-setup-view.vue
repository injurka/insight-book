<script setup lang="ts">
import type { SelectOption } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { pluginManager } from '~/00.plugins/plugin-manager'
import { DIFFICULTY_SYSTEMS } from '~/01.shared/constants/difficulties'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import { useDecksStore } from '~/05.modules/dictionary/store/decks.store'
import { useDictionaryFiltersStore } from '~/05.modules/dictionary/store/dictionary-filters.store'
import { useDictionaryWords } from '../../../composables/use-dictionary-words'
import { useTrainingStore } from '../../../store/training.store'

defineOptions({
  inheritAttrs: false,
})

const emit = defineEmits<{
  (e: 'start', payload: {
    deckId: (number | 'all' | 'none')[]
    difficulty: string[]
    modes: Record<string, boolean>
  }): void
  (e: 'close'): void
}>()

const customTrainingModes = computed(() => pluginManager.getWidgets('dictionary:training-modes'))

const trainingStore = useTrainingStore()
const decksStore = useDecksStore()
const filtersStore = useDictionaryFiltersStore()
const dictionaryWords = useDictionaryWords()
const { t } = useI18n()

const setupOptions = reactive({
  deckId: (Array.isArray(filtersStore.selectedDeckId) ? [...filtersStore.selectedDeckId] : [filtersStore.selectedDeckId]) as (number | 'all' | 'none')[],
  difficulty: (Array.isArray(filtersStore.selectedDifficulty) ? [...filtersStore.selectedDifficulty] : [filtersStore.selectedDifficulty]) as string[],
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
  if (setupOptions.deckId.length > 0 && !setupOptions.deckId.includes('all') && !setupOptions.deckId.includes('none')) {
    const firstSelectedDeckId = setupOptions.deckId.find((id): id is number => typeof id === 'number')
    if (firstSelectedDeckId !== undefined) {
      const deck = decksStore.decks.find(d => d.id === firstSelectedDeckId)
      if (deck)
        return deck.language
    }
  }

  return filtersStore.selectedLanguage !== 'all' ? filtersStore.selectedLanguage : 'all'
})

const showWritingMode = computed(() => {
  const hasChinese = dictionaryWords.value.some(c => c.language === 'zh' && /[\u4E00-\u9FA5]/.test(c.word || ''))

  return currentLang.value === 'zh' && hasChinese
})

const activeModesCount = computed(() => {
  if (trainingStore.trainingMode === 'deep_dive') {
    const list = [modes.scramble, modes.collocations, showWritingMode.value && modes.radicals]

    return list.filter(Boolean).length
  }

  const list = [
    modes.standard,
    modes.typing,
    modes.choice,
    modes['choice-reverse'],
    modes.audio,
    showWritingMode.value && modes.writing,
  ]

  return list.filter(Boolean).length
})

watch(() => trainingStore.trainingMode, () => {
  (Object.keys(modes) as Array<keyof typeof modes>).forEach((key) => {
    modes[key] = false
  })
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
  decksStore.decks.forEach((d) => {
    if (filtersStore.selectedLanguage === 'all' || d.language === filtersStore.selectedLanguage)
      opts.push({ label: d.name, value: d.id })
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
  setupOptions.deckId = setupOptions.deckId.filter(d => newOpts.some(o => o.value === d))
  if (setupOptions.deckId.length === 0)
    setupOptions.deckId = ['all']
})

watch(difficultyOptions, (newOpts) => {
  setupOptions.difficulty = setupOptions.difficulty.filter(d => newOpts.some(o => o.value === d))
  if (setupOptions.difficulty.length === 0)
    setupOptions.difficulty = ['all']
})

function selectAllModes() {
  if (trainingStore.trainingMode === 'deep_dive') {
    modes.scramble = true
    modes.collocations = true
    if (showWritingMode.value)
      modes.radicals = true
  }
  else {
    modes.standard = true
    modes.typing = true
    modes.choice = true
    modes['choice-reverse'] = true
    modes.audio = true
    if (showWritingMode.value)
      modes.writing = true
  }
}

function resetModes() {
  (Object.keys(modes) as Array<keyof typeof modes>).forEach((key) => {
    modes[key] = false
  })
}

function start() {
  const selectedModes = { ...modes }

  if (trainingStore.trainingMode === 'match') {
    emit('start', { ...setupOptions, modes: selectedModes })

    return
  }

  const hasAnyMode = Object.values(selectedModes).some(Boolean)

  if (!hasAnyMode) {
    if (trainingStore.trainingMode === 'deep_dive')
      selectedModes.scramble = true

    else
      selectedModes.standard = true
  }

  emit('start', { ...setupOptions, modes: selectedModes })
}
</script>

<template>
  <div class="setup-state">
    <!-- Filters Section -->
    <div class="settings-group filters-group">
      <div class="group-header">
        <div class="header-left">
          <Icon icon="mdi:filter-variant" class="group-icon" />
          <span class="group-label">{{ t('dictionary.filterParams') }}</span>
        </div>
      </div>
      <div class="form-row">
        <div class="form-col">
          <label class="form-label">
            <Icon icon="mdi:cards-outline" class="label-icon" />
            <span>{{ t('dictionary.deck') }}</span>
          </label>
          <KitSelect v-model="setupOptions.deckId" :options="deckOptions" multiple />
        </div>
        <div class="form-col">
          <label class="form-label">
            <Icon icon="mdi:speedometer-outline" class="label-icon" />
            <span>{{ t('dictionary.difficulty') }}</span>
          </label>
          <KitSelect v-model="setupOptions.difficulty" :options="difficultyOptions" multiple />
        </div>
      </div>
    </div>

    <!-- Modes Section -->
    <div class="settings-group modes-group">
      <div class="group-header">
        <div class="header-left">
          <Icon icon="mdi:tune-vertical" class="group-icon" />
          <span class="group-label">{{ t('dictionary.trainingModes') }}</span>
          <span
            v-if="trainingStore.trainingMode !== 'match'"
            class="modes-badge"
            :class="{ 'is-selected': activeModesCount > 0 }"
          >
            {{ activeModesCount > 0 ? (activeModesCount === 1 ? '1 выбран' : `${activeModesCount} выбрано`) : 'Чтение (по умолч.)' }}
          </span>
        </div>

        <div v-if="trainingStore.trainingMode !== 'match'" class="modes-quick-actions">
          <button
            type="button"
            class="quick-action-btn"
            :title="t('dictionary.selectAll')"
            @click="selectAllModes"
          >
            <Icon icon="mdi:checkbox-multiple-marked-outline" />
            <span>{{ t('dictionary.selectAll') }}</span>
          </button>
          <button
            v-if="activeModesCount > 0"
            type="button"
            class="quick-action-btn"
            :title="t('dictionary.reset')"
            @click="resetModes"
          >
            <Icon icon="mdi:refresh" />
            <span>{{ t('dictionary.reset') }}</span>
          </button>
        </div>
      </div>

      <div v-if="trainingStore.trainingMode === 'match'" class="empty-modes-message">
        <Icon icon="mdi:information-outline" class="info-icon" />
        <p>{{ t('dictionary.noExtraModesForMatch') }}</p>
      </div>
      <div v-else class="modes-grid">
        <template v-if="trainingStore.trainingMode !== 'deep_dive'">
          <!-- Standard Cards -->
          <div
            class="mode-card"
            :class="{ 'is-active': modes.standard }"
            style="--mode-accent: #3b82f6"
            tabindex="0"
            role="checkbox"
            :aria-checked="modes.standard"
            @click="modes.standard = !modes.standard"
            @keydown.enter.prevent="modes.standard = !modes.standard"
            @keydown.space.prevent="modes.standard = !modes.standard"
          >
            <div class="mode-card-top">
              <div class="mode-icon-box">
                <Icon icon="mdi:card-text-outline" class="mode-icon" />
              </div>
              <div class="mode-checkbox" :class="{ 'is-checked': modes.standard }">
                <Icon v-if="modes.standard" icon="mdi:check" />
              </div>
            </div>
            <div class="mode-card-body">
              <span class="mode-title">{{ t('dictionary.reading') }}</span>
              <span class="mode-desc">{{ t('dictionary.classicCards') }}</span>
            </div>
          </div>

          <!-- Typing -->
          <div
            class="mode-card"
            :class="{ 'is-active': modes.typing }"
            style="--mode-accent: #10b981"
            tabindex="0"
            role="checkbox"
            :aria-checked="modes.typing"
            @click="modes.typing = !modes.typing"
            @keydown.enter.prevent="modes.typing = !modes.typing"
            @keydown.space.prevent="modes.typing = !modes.typing"
          >
            <div class="mode-card-top">
              <div class="mode-icon-box">
                <Icon icon="mdi:keyboard-outline" class="mode-icon" />
              </div>
              <div class="mode-checkbox" :class="{ 'is-checked': modes.typing }">
                <Icon v-if="modes.typing" icon="mdi:check" />
              </div>
            </div>
            <div class="mode-card-body">
              <span class="mode-title">{{ t('dictionary.typing') }}</span>
              <span class="mode-desc">{{ t('dictionary.writeByMemory') }}</span>
            </div>
          </div>

          <!-- Multiple Choice Test -->
          <div
            class="mode-card"
            :class="{ 'is-active': modes.choice }"
            style="--mode-accent: #8b5cf6"
            tabindex="0"
            role="checkbox"
            :aria-checked="modes.choice"
            @click="modes.choice = !modes.choice"
            @keydown.enter.prevent="modes.choice = !modes.choice"
            @keydown.space.prevent="modes.choice = !modes.choice"
          >
            <div class="mode-card-top">
              <div class="mode-icon-box">
                <Icon icon="mdi:format-list-checks" class="mode-icon" />
              </div>
              <div class="mode-checkbox" :class="{ 'is-checked': modes.choice }">
                <Icon v-if="modes.choice" icon="mdi:check" />
              </div>
            </div>
            <div class="mode-card-body">
              <span class="mode-title">{{ t('dictionary.test') }}</span>
              <span class="mode-desc">{{ t('dictionary.multipleChoice') }}</span>
            </div>
          </div>

          <!-- Reverse Choice Test -->
          <div
            class="mode-card"
            :class="{ 'is-active': modes['choice-reverse'] }"
            style="--mode-accent: #f59e0b"
            tabindex="0"
            role="checkbox"
            :aria-checked="modes['choice-reverse']"
            @click="modes['choice-reverse'] = !modes['choice-reverse']"
            @keydown.enter.prevent="modes['choice-reverse'] = !modes['choice-reverse']"
            @keydown.space.prevent="modes['choice-reverse'] = !modes['choice-reverse']"
          >
            <div class="mode-card-top">
              <div class="mode-icon-box">
                <Icon icon="mdi:swap-horizontal-bold" class="mode-icon" />
              </div>
              <div class="mode-checkbox" :class="{ 'is-checked': modes['choice-reverse'] }">
                <Icon v-if="modes['choice-reverse']" icon="mdi:check" />
              </div>
            </div>
            <div class="mode-card-body">
              <span class="mode-title">{{ t('dictionary.choiceReverse') }}</span>
              <span class="mode-desc">{{ t('dictionary.choiceReverseDesc') }}</span>
            </div>
          </div>

          <!-- Audio Listening -->
          <div
            class="mode-card"
            :class="{ 'is-active': modes.audio }"
            style="--mode-accent: #ec4899"
            tabindex="0"
            role="checkbox"
            :aria-checked="modes.audio"
            @click="modes.audio = !modes.audio"
            @keydown.enter.prevent="modes.audio = !modes.audio"
            @keydown.space.prevent="modes.audio = !modes.audio"
          >
            <div class="mode-card-top">
              <div class="mode-icon-box">
                <Icon icon="mdi:headphones" class="mode-icon" />
              </div>
              <div class="mode-checkbox" :class="{ 'is-checked': modes.audio }">
                <Icon v-if="modes.audio" icon="mdi:check" />
              </div>
            </div>
            <div class="mode-card-body">
              <span class="mode-title">{{ t('dictionary.listening') }}</span>
              <span class="mode-desc">{{ t('dictionary.aiSpeech') }}</span>
            </div>
          </div>

          <!-- Writing (Chinese / Hanzi) -->
          <div
            v-if="showWritingMode"
            class="mode-card"
            :class="{ 'is-active': modes.writing }"
            style="--mode-accent: #06b6d4"
            tabindex="0"
            role="checkbox"
            :aria-checked="modes.writing"
            @click="modes.writing = !modes.writing"
            @keydown.enter.prevent="modes.writing = !modes.writing"
            @keydown.space.prevent="modes.writing = !modes.writing"
          >
            <div class="mode-card-top">
              <div class="mode-icon-box">
                <Icon icon="mdi:draw" class="mode-icon" />
              </div>
              <div class="mode-checkbox" :class="{ 'is-checked': modes.writing }">
                <Icon v-if="modes.writing" icon="mdi:check" />
              </div>
            </div>
            <div class="mode-card-body">
              <span class="mode-title">{{ t('dictionary.writing') }}</span>
              <span class="mode-desc">{{ t('dictionary.hanziByMemory') }}</span>
            </div>
          </div>
        </template>
        <template v-else>
          <!-- Scramble -->
          <div
            class="mode-card"
            :class="{ 'is-active': modes.scramble }"
            style="--mode-accent: #6366f1"
            tabindex="0"
            role="checkbox"
            :aria-checked="modes.scramble"
            @click="modes.scramble = !modes.scramble"
            @keydown.enter.prevent="modes.scramble = !modes.scramble"
            @keydown.space.prevent="modes.scramble = !modes.scramble"
          >
            <div class="mode-card-top">
              <div class="mode-icon-box">
                <Icon icon="mdi:puzzle-outline" class="mode-icon" />
              </div>
              <div class="mode-checkbox" :class="{ 'is-checked': modes.scramble }">
                <Icon v-if="modes.scramble" icon="mdi:check" />
              </div>
            </div>
            <div class="mode-card-body">
              <span class="mode-title">{{ t('dictionary.scramble') }}</span>
              <span class="mode-desc">{{ t('dictionary.scrambleDesc') }}</span>
            </div>
          </div>

          <!-- Collocations -->
          <div
            class="mode-card"
            :class="{ 'is-active': modes.collocations }"
            style="--mode-accent: #f97316"
            tabindex="0"
            role="checkbox"
            :aria-checked="modes.collocations"
            @click="modes.collocations = !modes.collocations"
            @keydown.enter.prevent="modes.collocations = !modes.collocations"
            @keydown.space.prevent="modes.collocations = !modes.collocations"
          >
            <div class="mode-card-top">
              <div class="mode-icon-box">
                <Icon icon="mdi:link-variant" class="mode-icon" />
              </div>
              <div class="mode-checkbox" :class="{ 'is-checked': modes.collocations }">
                <Icon v-if="modes.collocations" icon="mdi:check" />
              </div>
            </div>
            <div class="mode-card-body">
              <span class="mode-title">{{ t('dictionary.collocations') }}</span>
              <span class="mode-desc">{{ t('dictionary.collocationsDesc') }}</span>
            </div>
          </div>

          <!-- Radicals (Chinese) -->
          <div
            v-if="showWritingMode"
            class="mode-card"
            :class="{ 'is-active': modes.radicals }"
            style="--mode-accent: #eab308"
            tabindex="0"
            role="checkbox"
            :aria-checked="modes.radicals"
            @click="modes.radicals = !modes.radicals"
            @keydown.enter.prevent="modes.radicals = !modes.radicals"
            @keydown.space.prevent="modes.radicals = !modes.radicals"
          >
            <div class="mode-card-top">
              <div class="mode-icon-box">
                <Icon icon="mdi:format-annotation-plus" class="mode-icon" />
              </div>
              <div class="mode-checkbox" :class="{ 'is-checked': modes.radicals }">
                <Icon v-if="modes.radicals" icon="mdi:check" />
              </div>
            </div>
            <div class="mode-card-body">
              <span class="mode-title">{{ t('dictionary.radicals') }}</span>
              <span class="mode-desc">{{ t('dictionary.radicalsDesc') }}</span>
            </div>
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

    <!-- Actions & Hint Footer -->
    <div class="setup-actions">
      <div v-if="trainingStore.trainingMode !== 'match'" class="setup-hint">
        <Icon icon="mdi:shuffle-variant" class="hint-icon" />
        <span>{{ t('dictionary.modesShuffleHint') }}</span>
      </div>
      <div class="buttons-wrap">
        <KitBtn variant="tonal" size="md" @click="emit('close')">
          {{ t('dictionary.cancel') }}
        </KitBtn>
        <KitBtn
          color="primary"
          size="md"
          prepend-icon="mdi:play"
          @click="start"
        >
          {{ t('dictionary.start') }}
        </KitBtn>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.setup-state {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;

  .settings-group {
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: var(--bg-secondary-color);
    padding: 16px 18px;
    border-radius: 16px;
    border: 1px solid var(--border-secondary-color);

    .group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;

      .header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .group-icon {
        font-size: 1.15rem;
        color: var(--fg-accent-color);
      }

      .group-label {
        font-size: 0.95rem;
        font-weight: 600;
        color: var(--fg-primary-color);
      }

      .modes-badge {
        font-size: 0.75rem;
        font-weight: 500;
        padding: 2px 9px;
        border-radius: var(--r-full, 9999px);
        background: var(--bg-primary-color);
        border: 1px solid var(--border-primary-color);
        color: var(--fg-secondary-color);
        transition: all 0.2s ease;

        &.is-selected {
          background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.12);
          border-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.35);
          color: var(--fg-accent-color);
          font-weight: 600;
        }
      }

      .modes-quick-actions {
        display: flex;
        align-items: center;
        gap: 6px;

        .quick-action-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--fg-secondary-color);
          background: var(--bg-primary-color);
          border: 1px solid var(--border-primary-color);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover {
            color: var(--fg-primary-color);
            background: var(--bg-hover-color);
            border-color: var(--border-secondary-color);
          }

          &:focus-visible {
            outline: 2px solid var(--fg-accent-color);
            outline-offset: 1px;
          }
        }
      }
    }

    .empty-modes-message {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: var(--fg-secondary-color);
      font-size: 0.875rem;
      padding: 28px 16px;
      background: var(--bg-primary-color);
      border: 1px dashed var(--border-primary-color);
      border-radius: 12px;
      text-align: center;

      .info-icon {
        font-size: 1.35rem;
        color: var(--fg-accent-color);
        flex-shrink: 0;
      }

      p {
        margin: 0;
      }
    }

    .modes-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;

      @include media-down(sm) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .mode-card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px;
        background: var(--bg-primary-color);
        border: 1px solid var(--border-primary-color);
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
        outline: none;

        &:hover {
          border-color: var(--border-secondary-color);
          background: var(--bg-hover-color);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);

          .mode-icon-box {
          }
        }

        &:focus-visible {
          box-shadow: 0 0 0 2px var(--fg-accent-color);
        }

        &.is-active {
          border-color: var(--fg-accent-color);
          background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.04);
          box-shadow:
            0 0 0 1px var(--fg-accent-color),
            0 4px 16px rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.12);

          &:hover {
            box-shadow:
              0 0 0 1px var(--fg-accent-color),
              0 6px 20px rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.18);
          }

          .mode-icon-box {
            background: color-mix(in srgb, var(--mode-accent, var(--fg-accent-color)) 18%, transparent);
            color: var(--mode-accent, var(--fg-accent-color));
          }
        }

        .mode-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .mode-icon-box {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--bg-secondary-color);
          color: var(--fg-secondary-color);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

          .mode-icon {
            font-size: 1.35rem;
          }
        }

        .mode-checkbox {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 1.5px solid var(--border-primary-color);
          color: var(--fg-inverted-color, #fff);
          font-size: 0.8rem;
          transition: all 0.2s ease;

          &.is-checked {
            background: var(--fg-accent-color);
            border-color: var(--fg-accent-color);
            transform: scale(1.05);
          }
        }

        .mode-card-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
          text-align: left;
        }

        .mode-title {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--fg-primary-color);
          line-height: 1.25;
        }

        .mode-desc {
          font-size: 0.75rem;
          color: var(--fg-secondary-color);
          line-height: 1.3;
        }
      }
    }
  }

  .filters-group {
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

      .form-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--fg-secondary-color);

        .label-icon {
          font-size: 1rem;
          color: var(--fg-secondary-color);
        }
      }
    }
  }

  .setup-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding-top: 4px;
    flex-wrap: wrap;

    .setup-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      color: var(--fg-secondary-color);

      .hint-icon {
        font-size: 1rem;
        color: var(--fg-accent-color);
        flex-shrink: 0;
      }
    }

    .buttons-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: auto;
    }
  }
}
</style>
