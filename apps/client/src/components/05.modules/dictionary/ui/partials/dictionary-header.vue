<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDropdown, KitInput, KitSelect, KitTooltip } from '~/components/01.kit'
import { GlobalActions } from '~/components/04.features/global-actions'
import { useDictFilterOptions } from '../../composables/use-dict-filter-options'
import { useDictionaryStore } from '../../store/dictionary.store'

const emit = defineEmits<{
  openTraining: [mode: 'srs' | 'random' | 'deep_dive']
  openDiscover: []
  openManageDecks: []
  openStats: []
}>()

const isEditMode = defineModel<boolean>('isEditMode', { required: true })

const store = useDictionaryStore()
const { t } = useI18n()
const { langOptions, deckOptions, difficultyOptions, statusOptions } = useDictFilterOptions()

const router = useRouter()
const isMobileFiltersOpen = ref(false)
const dropdownRef = ref<InstanceType<typeof KitDropdown> | null>(null)

watch(() => store.selectedLanguage, () => {
  store.selectedDeckId = ['all']
  store.selectedDifficulty = ['all']
})

function openTrainingSettings(mode: 'srs' | 'random' | 'deep_dive') {
  store.trainingMode = mode
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
      <div class="search-wrapper">
        <KitInput
          v-model="store.searchTerm"
          :placeholder="t('dictionary.searchPlaceholder')"
          class="search-input"
        />
        <div class="mobile-controls">
          <KitBtn
            :icon="isMobileFiltersOpen ? 'mdi:chevron-up' : 'mdi:tune-variant'"
            variant="tonal"
            color="secondary"
            @click="isMobileFiltersOpen = !isMobileFiltersOpen"
          />
        </div>
      </div>

      <div class="extra-filters" :class="{ 'is-open': isMobileFiltersOpen }">
        <KitSelect
          v-model="store.selectedLanguage"
          :options="langOptions"
          class="filter-select"
        />
        <KitSelect
          v-model="store.selectedDeckId"
          :options="deckOptions"
          class="filter-select"
          multiple
        />
        <KitSelect
          v-model="store.selectedDifficulty"
          :options="difficultyOptions"
          class="filter-select"
          multiple
        />
        <KitSelect
          v-model="store.selectedStatus"
          :options="statusOptions"
          class="filter-select"
          multiple
        />
      </div>

      <div class="actions-and-stats">
        <div class="main-actions">
          <KitDropdown ref="dropdownRef" placement="bottom-end" width="260px" class="training-dropdown">
            <template #activator="{ props }">
              <KitBtn
                icon="mdi:brain"
                :color="store.totalReviewCount > 0 ? 'primary' : 'accent'"
                :variant="store.totalReviewCount > 0 ? 'solid' : 'outlined'"
                :class="{ 'is-active-btn': props.isOpen }"
                class="full-width-btn"
              >
                {{ t('dictionary.training') }} <Icon icon="mdi:chevron-down" class="ml-1" />
              </KitBtn>
            </template>
            <div class="dropdown-menu-list">
              <button class="dropdown-item" :disabled="store.words.length === 0" @click="openTrainingSettings('srs')">
                <Icon icon="mdi:calendar-clock" />
                {{ t('dictionary.srsTraining') }}
              </button>
              <button class="dropdown-item" :disabled="store.words.length === 0" @click="openTrainingSettings('random')">
                <Icon icon="mdi:shuffle-variant" />
                {{ t('dictionary.randomTraining') }}
              </button>
              <button class="dropdown-item" :disabled="store.words.length === 0" @click="openTrainingSettings('deep_dive')">
                <Icon icon="mdi:diving-scuba" />
                {{ t('dictionary.deepDiveTraining') }}
              </button>
            </div>
          </KitDropdown>

          <KitTooltip text="Discover & Import" placement="bottom">
            <KitBtn icon="mdi:bookshelf" variant="tonal" color="primary" @click="emit('openDiscover')" />
          </KitTooltip>

          <KitTooltip :text="t('dictionary.manageDecks')" placement="bottom">
            <KitBtn icon="mdi:folder-cog-outline" variant="tonal" color="secondary" @click="emit('openManageDecks')" />
          </KitTooltip>
        </div>

        <div class="stats-badge">
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
          </div>
        </div>
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

    .search-wrapper {
      flex-grow: 1;
      min-width: 250px;
      display: flex;
      gap: 8px;

      .search-input {
        width: 100%;
      }

      .mobile-controls {
        display: none;
      }
    }

    .extra-filters {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;

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

      .search-wrapper {
        min-width: 100%;

        .mobile-controls {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
      }

      .extra-filters {
        display: none;
        flex-direction: column;
        background-color: var(--bg-secondary-color);
        padding: 16px;
        border-radius: 12px;
        border: 1px solid var(--border-secondary-color);
        gap: 12px;

        &.is-open {
          display: flex;
          animation: slideDown 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
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
