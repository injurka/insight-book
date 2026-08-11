<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
import { KitDropdown } from '~/02.kit/molecules/kit-dropdown/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import { KitTooltip } from '~/02.kit/molecules/kit-tooltip/ui'
import { KitViewSwitcher } from '~/02.kit/molecules/kit-view-switcher/ui'
import { GlobalActions } from '~/04.features/global-actions'
import { useTrainingStore } from '~/05.modules/srs-training/store/training.store'
import { useDictFilterOptions } from '../../composables/use-dict-filter-options'
import { useDictionaryStore } from '../../store/dictionary.store'

const emit = defineEmits<{
  openTraining: [mode: 'srs' | 'deep_dive' | 'cram' | 'match']
  openDiscover: []
  openManageDecks: []
  openStats: []
  openQuiz: []
}>()

const isEditMode = defineModel<boolean>('isEditMode', { required: true })
const viewMode = defineModel<'list' | 'grid'>('viewMode', { required: true })

const { t } = useI18n()

const viewOptions = computed(() => [
  { id: 'list', icon: 'mdi:format-list-bulleted', label: t('dictionary.viewList') },
  { id: 'grid', icon: 'mdi:view-grid-outline', label: t('dictionary.viewGrid') },
])

const store = useDictionaryStore()
const trainingStore = useTrainingStore()
const { langOptions, deckOptions, difficultyOptions, statusOptions } = useDictFilterOptions()

const router = useRouter()
const isFiltersOpen = ref(false)
const dropdownRef = ref<InstanceType<typeof KitDropdown> | null>(null)

watch(() => store.selectedLanguage, () => {
  store.selectedDeckId = ['all']
  store.selectedDifficulty = ['all']
})

function openTrainingSettings(mode: 'srs' | 'deep_dive' | 'cram' | 'match') {
  trainingStore.trainingMode = mode
  emit('openTraining', mode)
  dropdownRef.value?.close()
}
</script>

<template>
  <header class="dict-header">
    <div class="header-top">
      <div class="title-group">
        <KitBtn icon="mdi:arrow-left" variant="text" @click="router.back()" />
        <h1>{{ t('dictionary.title') }}</h1>
      </div>
      <GlobalActions hide-dictionary />
    </div>

    <div class="header-bottom">
      <div class="actions-and-stats">
        <div class="main-actions">
          <KitDropdown
            ref="dropdownRef"
            placement="bottom-end"
            width="260px"
            class="training-dropdown"
          >
            <template #activator="{ props }">
              <KitBtn
                icon="mdi:brain"
                :color="trainingStore.totalReviewCount > 0 ? 'primary' : 'accent'"
                :variant="trainingStore.totalReviewCount > 0 ? 'solid' : 'outlined'"
                :class="{ 'is-active-btn': props.isOpen }"
                class="full-width-btn"
              >
                {{ t('dictionary.training') }} <Icon icon="mdi:chevron-down" class="ml-1" />
              </KitBtn>
            </template>
            <div class="dropdown-menu-list">
              <button class="dropdown-item" :disabled="store.words.length === 0" @click="openTrainingSettings('srs')">
                <Icon icon="mdi:calendar-clock" style="color: var(--fg-accent-color)" />
                <span style="color: var(--fg-accent-color); font-weight: 700;">{{ t('dictionary.srsTraining') }}</span>
              </button>
              <button class="dropdown-item" :disabled="store.words.length === 0" @click="openTrainingSettings('deep_dive')">
                <Icon icon="mdi:diving-scuba" />
                {{ t('dictionary.deepDiveTraining') }}
              </button>
              <button class="dropdown-item" :disabled="store.words.length === 0" @click="openTrainingSettings('cram')">
                <Icon icon="mdi:lightning-bolt-outline" />
                {{ t('dictionary.cramTraining') }}
              </button>
              <button class="dropdown-item" :disabled="store.words.length === 0" @click="openTrainingSettings('match')">
                <Icon icon="mdi:puzzle-outline" />
                {{ t('dictionary.matchTraining') }}
              </button>
            </div>
          </KitDropdown>

          <KitTooltip :text="t('dictionary.discover.title')" placement="bottom">
            <KitBtn
              icon="mdi:bookshelf"
              variant="tonal"
              color="primary"
              @click="emit('openDiscover')"
            />
          </KitTooltip>

          <KitTooltip :text="t('dictionary.manageDecks')" placement="bottom">
            <KitBtn
              icon="mdi:folder-cog-outline"
              variant="tonal"
              color="secondary"
              @click="emit('openManageDecks')"
            />
          </KitTooltip>

          <KitTooltip text="Пройти квиз по уровням" placement="bottom">
            <KitBtn
              icon="mdi:trophy-outline"
              variant="tonal"
              color="accent"
              @click="emit('openQuiz')"
            />
          </KitTooltip>
        </div>

        <div class="stats-badge">
          <KitViewSwitcher v-model="viewMode" :items="viewOptions" class="view-switcher-custom" />
          <span class="badge">{{ t('dictionary.wordsCount', { count: store.filteredWords.length }) }}</span>
          <div class="badge-actions">
            <KitTooltip :text="isEditMode ? t('dictionary.done') : t('dictionary.edit')" placement="bottom-end">
              <KitBtn
                :icon="isEditMode ? 'mdi:check' : 'mdi:pencil-outline'"
                variant="text"
                :color="isEditMode ? 'primary' : 'secondary'"
                @click="isEditMode = !isEditMode"
              />
            </KitTooltip>
            <KitTooltip :text="t('dictionary.stats')" placement="bottom-end">
              <KitBtn
                icon="mdi:chart-box-outline"
                variant="text"
                color="secondary"
                @click="emit('openStats')"
              />
            </KitTooltip>
            <KitTooltip :text="t('dictionary.filters')" placement="bottom-end">
              <KitBtn
                :icon="isFiltersOpen ? 'mdi:chevron-up' : 'mdi:tune-variant'"
                variant="text"
                :color="isFiltersOpen ? 'primary' : 'secondary'"
                @click="isFiltersOpen = !isFiltersOpen"
              />
            </KitTooltip>
          </div>
        </div>
      </div>

      <div class="extra-filters" :class="{ 'is-open': isFiltersOpen }">
        <KitInput
          v-model="store.searchTerm"
          :placeholder="t('dictionary.searchPlaceholder')"
          icon="mdi:magnify"
          color="secondary"
          class="filter-search-input"
        />
        <KitSelect
          v-model="store.selectedLanguage"
          :options="langOptions"
          icon="mdi:translate"
          color="secondary"
          class="filter-select"
        />
        <KitSelect
          v-model="store.selectedDeckId"
          :options="deckOptions"
          icon="mdi:folder-outline"
          color="secondary"
          class="filter-select"
          multiple
        />
        <KitSelect
          v-model="store.selectedDifficulty"
          :options="difficultyOptions"
          icon="mdi:chart-bar"
          color="secondary"
          class="filter-select"
          multiple
        />
        <KitSelect
          v-model="store.selectedStatus"
          :options="statusOptions"
          icon="mdi:check-circle-outline"
          color="secondary"
          class="filter-select"
          multiple
        />
      </div>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.dict-header {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 20px;
  flex-shrink: 0;

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .title-group {
      display: flex;
      align-items: center;
      gap: 12px;

      h1 {
        margin: 0;
        font-size: 1.5rem;
      }
    }
  }

  .header-bottom {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;

    .extra-filters {
      display: none;
      width: 100%;
      background-color: var(--bg-secondary-color);
      padding: 16px;
      border-radius: 12px;
      border: 1px solid var(--border-secondary-color);
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;

      &.is-open {
        display: flex;
        animation: slideDown 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
      }

      .filter-search-input {
        flex-grow: 1;
        min-width: 250px;
      }

      .filter-select {
        width: 170px;
        flex-shrink: 0;
      }
    }

    .actions-and-stats {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-left: auto;
      width: 100%;
      justify-content: space-between;

      .main-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .ml-1 {
        margin-left: 4px;
      }

      .stats-badge {
        display: flex;
        align-items: center;
        gap: 8px;

        .view-switcher-custom {
          margin-right: 8px;
          background: var(--bg-tertiary-color);
          border-color: transparent;
          height: 36px;
          border-radius: 99px;

          :deep(.kit-view-switcher-glider) {
            border-radius: 99px;
            background-color: var(--bg-secondary-color);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }

          :deep(.kit-view-switcher-button) {
            min-height: 28px;
            padding: 4px 12px;
            border-radius: 99px;
            font-size: 0.85rem;
          }

          @include media-down(sm) {
            display: none;
          }
        }

        .badge {
          background: var(--bg-tertiary-color);
          padding: 8px 12px;
          border-radius: 99px;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--fg-secondary-color);
          white-space: nowrap;
          display: inline-block;
        }

        .badge-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: auto;
        }
      }
    }

    @include media-down(md) {
      flex-direction: column;
      align-items: stretch;

      .extra-filters {
        flex-direction: column;
        align-items: stretch;

        .filter-search-input {
          width: 100%;
        }

        .filter-select {
          width: 100%;
        }
      }

      .actions-and-stats {
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        width: 100%;
        margin-left: 0;
        gap: 12px;

        .main-actions {
          width: 100%;
          display: flex;

          .training-dropdown {
            flex: 1;

            :deep(.kit-select-trigger),
            .full-width-btn {
              width: 100%;
              justify-content: center;
            }
          }
        }

        .stats-badge {
          width: 100%;
        }
      }
    }
  }
}

.dropdown-menu-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--fg-primary-color);
  font-size: 0.95rem;
  font-family: inherit;
  cursor: pointer;
  border-radius: 6px;
  transition:
    background-color 0.2s,
    color 0.2s;
  text-align: left;
  width: 100%;

  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    font-size: 1.15rem;
  }
}
</style>
