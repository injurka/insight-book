<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitSelect } from '~/components/01.kit'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { useDictionaryStore } from '../../../store/dictionary.store'

const emit = defineEmits(['start', 'close'])

const dictStore = useDictionaryStore()
const { t } = useI18n()

const setupOptions = reactive({
  deckId: dictStore.selectedDeckId as number | 'all' | 'none',
  difficulty: dictStore.selectedDifficulty as string | 'all' | 'none',
})

const modes = reactive({
  standard: true,
  audio: true,
  writing: false,
  typing: true,
  choice: true,
})

const hasChineseWords = computed(() => {
  return dictStore.words.some(c => c.language === 'zh' && /[\u4E00-\u9FA5]/.test(c.word || ''))
})

const currentLang = computed(() => {
  if (setupOptions.deckId !== 'all' && setupOptions.deckId !== 'none') {
    const deck = dictStore.decks.find(d => d.id === setupOptions.deckId)
    if (deck)
      return deck.language
  }
  return dictStore.selectedLanguage !== 'all' ? dictStore.selectedLanguage : 'all'
})

const deckOptions = computed(() => {
  const opts: any[] = [
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
  const opts: any[] = [{ label: t('dictionary.allDifficulties'), value: 'all' }, { label: t('dictionary.noDifficulty'), value: 'none' }]
  const sys = DIFFICULTY_SYSTEMS[currentLang.value] || DIFFICULTY_SYSTEMS.all
  sys.forEach(d => opts.push({ label: d.label, value: d.value }))
  return opts
})

watch(deckOptions, (newOpts) => {
  if (!newOpts.some(o => o.value === setupOptions.deckId)) {
    setupOptions.deckId = 'all'
  }
})

watch(difficultyOptions, (newOpts) => {
  if (!newOpts.some(o => o.value === setupOptions.difficulty)) {
    setupOptions.difficulty = 'all'
  }
})

function start() {
  const selectedModes = { ...modes }
  if (!selectedModes.standard && !selectedModes.audio && !selectedModes.writing && !selectedModes.typing && !selectedModes.choice) {
    selectedModes.standard = true
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
          <KitSelect v-model="setupOptions.difficulty" :options="difficultyOptions" />
        </div>
      </div>
    </div>

    <div class="settings-group">
      <label class="group-label">{{ t('dictionary.trainingModes') }}</label>
      <div class="modes-grid">
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
        <div class="mode-card" :class="{ 'is-active': modes.audio }" @click="modes.audio = !modes.audio">
          <Icon icon="mdi:headphones" class="mode-icon" />
          <span class="mode-title">{{ t('dictionary.listening') }}</span>
          <span class="mode-desc">{{ t('dictionary.aiSpeech') }}</span>
        </div>
        <div v-if="hasChineseWords" class="mode-card" :class="{ 'is-active': modes.writing }" @click="modes.writing = !modes.writing">
          <Icon icon="mdi:draw" class="mode-icon" />
          <span class="mode-title">{{ t('dictionary.writing') }}</span>
          <span class="mode-desc">{{ t('dictionary.hanziByMemory') }}</span>
        </div>
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

    .modes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
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
