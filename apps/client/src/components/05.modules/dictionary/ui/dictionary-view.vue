<!-- eslint-disable no-alert -->
<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useVirtualList } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { KitBtn, KitDropdown, KitInput, KitPrompt, KitSelect, KitTooltip } from '~/components/01.kit'
import { GlobalActions } from '~/components/04.features/global-actions'
import { useToast } from '~/shared/composables/use-toast'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useDictionaryStore } from '../store/dictionary.store'
import SrsTrainingDialog from './srs-training-dialog.vue'

const store = useDictionaryStore()
const analysisStore = useAnalysisStore()
const router = useRouter()
const toast = useToast()

const isTrainingOpen = ref(false)
const isMobileFiltersOpen = ref(false)
const isMobileDecksOpen = ref(false)
const dropdownRef = ref<InstanceType<typeof KitDropdown> | null>(null)

const isCreatePromptOpen = ref(false)
const isRenamePromptOpen = ref(false)
const isDeleteConfirmOpen = ref(false)
const renameDeckTarget = ref<{ id: number, name: string } | null>(null)
const deleteDeckTarget = ref<{ id: number, name: string } | null>(null)

const langOptions = computed(() => {
  const opts = [{ label: 'Все языки', value: 'all' }]
  store.availableLanguages.forEach(l => opts.push({ label: l.toUpperCase(), value: l }))
  return opts
})

const statusOptions = [
  { label: 'Все статусы', value: 'all' },
  { label: 'Новые', value: '0' },
  { label: 'Изучаю', value: '1' },
  { label: 'Повторение', value: '2' },
  { label: 'Выучено', value: '3' },
]

const { list, containerProps, wrapperProps } = useVirtualList(
  computed(() => store.filteredWords),
  { itemHeight: 110 },
)

onMounted(() => {
  store.fetchDictionary()
})

function getStatusLabel(status: number) {
  switch (status) {
    case 0: return { label: 'Новое', color: 'var(--fg-info-color)' }
    case 1: return { label: 'Изучаю', color: 'var(--fg-warning-color)' }
    case 2: return { label: 'Повторение', color: 'var(--fg-accent-color)' }
    case 3: return { label: 'Выучено', color: 'var(--fg-success-color)' }
    default: return { label: 'Неизв.', color: 'var(--fg-muted-color)' }
  }
}

function getDifficultyClass(lang: string, diffValue: string | null) {
  if (!diffValue)
    return ''
  const system = DIFFICULTY_SYSTEMS[lang] || DIFFICULTY_SYSTEMS.default
  const found = system.find(s => s.value === diffValue)

  if (!found)
    return ''
  if (found.level <= 2)
    return 'level-easy'
  if (found.level <= 4)
    return 'level-medium'
  return 'level-hard'
}

async function startSrsTraining() {
  await store.fetchReviewQueue()
  if (store.reviewQueue.length > 0) {
    isTrainingOpen.value = true
  }
  else {
    toast.info('Нет карточек для повторения.')
  }
  dropdownRef.value?.close()
}

async function startRandomTraining() {
  await store.fetchRandomQueue()
  if (store.reviewQueue.length > 0) {
    isTrainingOpen.value = true
  }
  else {
    toast.info('Словарь пуст для этой языковой пары.')
  }
  dropdownRef.value?.close()
}

function openCreateDeck() {
  isCreatePromptOpen.value = true
}

async function onCreateDeckSubmit(name: string) {
  if (name.trim()) {
    const lang = store.selectedLanguage !== 'all' ? store.selectedLanguage : 'en'
    await store.createDeck(name.trim(), lang)
  }
}

function openRenameDeck(id: number, currentName: string) {
  renameDeckTarget.value = { id, name: currentName }
  isRenamePromptOpen.value = true
}

async function onRenameDeckSubmit(newName: string) {
  if (renameDeckTarget.value && newName.trim() && newName !== renameDeckTarget.value.name) {
    await store.updateDeck(renameDeckTarget.value.id, newName.trim())
  }
  renameDeckTarget.value = null
}

function openDeleteDeck(id: number, name: string) {
  deleteDeckTarget.value = { id, name }
  isDeleteConfirmOpen.value = true
}

async function onDeleteDeckConfirm() {
  if (deleteDeckTarget.value) {
    await store.deleteDeck(deleteDeckTarget.value.id)
  }
  deleteDeckTarget.value = null
}

const filteredDecks = computed(() => {
  if (store.selectedLanguage === 'all')
    return store.decks
  return store.decks.filter(d => d.language === store.selectedLanguage)
})
</script>

<template>
  <div class="dictionary-page">
    <header class="dict-header">
      <div class="header-top">
        <div class="title-group">
          <KitBtn icon="mdi:arrow-left" variant="text" @click="router.back()" />
          <h1>Мой словарь</h1>
        </div>

        <GlobalActions hide-dictionary />
      </div>

      <div class="header-bottom">
        <div class="search-wrapper">
          <KitInput
            v-model="store.searchTerm"
            placeholder="Поиск по слову, переводу..."
            class="search-input"
          />
          <div class="mobile-controls">
            <KitBtn
              :icon="isMobileDecksOpen ? 'mdi:folder-open-outline' : 'mdi:folder-outline'"
              variant="tonal"
              color="secondary"
              @click="isMobileDecksOpen = !isMobileDecksOpen"
            />
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
            class="lang-select"
          />
          <KitSelect
            v-model="store.selectedStatus"
            :options="statusOptions"
            class="status-select"
          />
        </div>

        <div class="actions-and-stats">
          <KitDropdown ref="dropdownRef" placement="bottom-end" width="230px">
            <template #activator="{ props }">
              <KitBtn
                icon="mdi:brain"
                :color="store.totalReviewCount > 0 ? 'primary' : 'accent'"
                :variant="store.totalReviewCount > 0 ? 'solid' : 'outlined'"
                :class="{ 'is-active-btn': props.isOpen }"
              >
                Тренировка <Icon icon="mdi:chevron-down" class="ml-1" />
              </KitBtn>
            </template>
            <div class="dropdown-menu-list">
              <button class="dropdown-item" :disabled="store.totalReviewCount === 0" @click="startSrsTraining">
                <Icon icon="mdi:calendar-clock" />
                Интервальное ({{ store.totalReviewCount }})
              </button>
              <button class="dropdown-item" :disabled="store.words.length === 0" @click="startRandomTraining">
                <Icon icon="mdi:shuffle-variant" />
                Случайная разминка
              </button>
            </div>
          </KitDropdown>

          <div class="stats-badge">
            <span class="badge">{{ store.filteredWords.length }} слов</span>
          </div>
        </div>
      </div>
    </header>

    <div class="dict-layout">
      <!-- Сайдбар с колодами -->
      <aside class="decks-sidebar" :class="{ 'is-open': isMobileDecksOpen }">
        <div class="decks-header">
          <h3>Колоды</h3>
          <KitBtn icon="mdi:plus" variant="text" size="xs" @click="openCreateDeck" />
        </div>
        <ul class="decks-list">
          <li :class="{ active: store.selectedDeckId === 'all' }" @click="store.selectedDeckId = 'all'">
            <Icon icon="mdi:format-list-bulleted" /> Все карточки
          </li>
          <li :class="{ active: store.selectedDeckId === 'none' }" @click="store.selectedDeckId = 'none'">
            <Icon icon="mdi:folder-outline" /> Без колоды
          </li>
          <li
            v-for="deck in filteredDecks"
            :key="deck.id"
            :class="{ active: store.selectedDeckId === deck.id }"
            class="deck-item"
            @click="store.selectedDeckId = deck.id"
          >
            <div class="deck-name-wrap">
              <Icon icon="mdi:folder-star-outline" />
              <span class="deck-name">{{ deck.name }}</span>
            </div>
            <div class="deck-actions">
              <button @click.stop="openRenameDeck(deck.id, deck.name)">
                <Icon width="12" height="12" icon="mdi:pencil" />
              </button>
              <button @click.stop="openDeleteDeck(deck.id, deck.name)">
                <Icon width="12" height="12" icon="mdi:delete-outline" />
              </button>
            </div>
          </li>
        </ul>
      </aside>

      <!-- Основной контент (список слов) -->
      <div class="words-content">
        <div v-if="!store.words.length && !store.isLoading" class="empty-state">
          <p>Вы пока не добавили ни одного слова.</p>
        </div>

        <div v-else-if="!store.filteredWords.length && !store.isLoading" class="empty-state">
          <p>По вашему запросу ничего не найдено.</p>
        </div>

        <div v-else class="virtual-list-container" v-bind="containerProps">
          <div v-bind="wrapperProps" class="virtual-list-wrapper">
            <div v-for="item in list" :key="item.data.id" class="dict-item">
              <div class="dict-item-content">
                <div class="dict-word-container">
                  <span class="dict-word">{{ item.data.word }}</span>
                  <span class="dict-transcription">{{ item.data.transcription }}</span>
                  <span
                    v-if="item.data.difficulty"
                    class="diff-badge"
                    :class="getDifficultyClass(item.data.language, item.data.difficulty)"
                  >
                    {{ item.data.difficulty }}
                  </span>
                  <span class="srs-badge" :style="{ color: getStatusLabel(item.data.status).color }">
                    {{ getStatusLabel(item.data.status).label }}
                  </span>
                </div>
                <div class="dict-translation" v-html="item.data.translation" />
              </div>
              <div class="dict-actions">
                <KitTooltip text="Редактировать" placement="top">
                  <KitBtn icon="mdi:pencil" variant="text" size="xs" @click="analysisStore.wordToEdit = item.data; analysisStore.addEditWordModalOpen = true;" />
                </KitTooltip>
                <KitTooltip text="Удалить" placement="top-end">
                  <KitBtn icon="mdi:delete-outline" variant="text" size="xs" @click="store.deleteWord(item.data.word)" />
                </KitTooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Диалоги -->
    <SrsTrainingDialog v-model:visible="isTrainingOpen" @finished="store.fetchReviewQueue" />

    <KitPrompt
      v-model:visible="isCreatePromptOpen"
      title="Новая колода"
      placeholder="Название колоды"
      confirm-text="Создать"
      @submit="onCreateDeckSubmit"
    />

    <KitPrompt
      v-model:visible="isRenamePromptOpen"
      title="Переименовать колоду"
      placeholder="Новое название"
      :default-value="renameDeckTarget?.name"
      confirm-text="Сохранить"
      @submit="onRenameDeckSubmit"
    />

    <KitPrompt
      v-model:visible="isDeleteConfirmOpen"
      title="Удаление колоды"
      :description="`Удалить колоду «${deleteDeckTarget?.name}»? Сами карточки не удалятся, а просто перейдут в общий список «Без колоды».`"
      :hide-input="true"
      confirm-text="Удалить"
      cancel-text="Отмена"
      @submit="onDeleteDeckConfirm"
    />
  </div>
</template>

<style lang="scss" scoped>
.dictionary-page {
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;

  @include media-down(md) {
    padding: 8px;
  }
}
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
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;

    .search-wrapper {
      flex-grow: 1;
      max-width: 300px;
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

      .lang-select,
      .status-select {
        width: 160px;
        flex-shrink: 0;
      }
    }

    .actions-and-stats {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: auto;

      .ml-1 {
        margin-left: 4px;
      }

      .stats-badge .badge {
        background: var(--bg-tertiary-color);
        padding: 8px 12px;
        border-radius: 99px;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--fg-secondary-color);
        white-space: nowrap;
        display: inline-block;
      }
    }

    @include media-down(md) {
      flex-direction: column;
      align-items: stretch;

      .search-wrapper {
        max-width: 100%;
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

        .lang-select,
        .status-select {
          width: 100%;
        }
      }

      .actions-and-stats {
        justify-content: space-between;
        width: 100%;
        margin-left: 0;

        .kit-btn {
          flex-grow: 1;
          justify-content: center;
        }

        .stats-badge {
          flex-shrink: 0;
        }
      }
    }
  }
}

.dict-layout {
  display: flex;
  flex-grow: 1;
  gap: 20px;
  min-height: 0;

  @include media-down(md) {
    flex-direction: column;
  }
}

.decks-sidebar {
  width: 250px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  padding: 12px;

  @include media-down(md) {
    display: none;
    width: 100%;
    max-height: 250px;
    margin-bottom: 12px;

    &.is-open {
      display: flex;
      animation: slideDown 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
  }

  .decks-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    h3 {
      margin: 0;
      font-size: 1rem;
      color: var(--fg-primary-color);
    }
  }

  .decks-list {
    list-style: none;
    padding: 0;
    margin: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background-color: var(--border-primary-color);
      border-radius: 4px;
    }

    li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
      transition: all 0.2s;
      height: 36px;

      .deck-name-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        overflow: hidden;
      }

      .deck-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .deck-actions {
        display: none;
        gap: 4px;

        button {
          background: transparent;
          border: none;
          color: var(--fg-secondary-color);
          cursor: pointer;

          &:hover {
            color: var(--fg-accent-color);
          }
        }
      }

      &:hover {
        background-color: var(--bg-hover-color);
        color: var(--fg-primary-color);

        .deck-actions {
          display: flex;
        }
      }

      &.active {
        background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.15);
        color: var(--fg-accent-color);
        font-weight: 500;
      }
    }
  }
}

.words-content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.virtual-list-container {
  flex-grow: 1;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}
.virtual-list-wrapper {
  display: flex;
  flex-direction: column;
}
.dict-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  background-color: var(--bg-secondary-color);
  border-radius: 8px;
  border: 1px solid var(--border-secondary-color);
  margin-bottom: 12px;
  overflow: hidden;

  .dict-item-content {
    flex-grow: 1;
    min-width: 0;
  }
  .dict-word-container {
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    .dict-word {
      font-size: 1.2rem;
      font-weight: bold;
      color: var(--fg-accent-color);
    }
    .dict-transcription {
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
    }
  }
  .dict-translation {
    font-size: 0.95rem;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .dict-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
}

.diff-badge {
  font-size: 0.7rem;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;

  &.level-easy {
    background-color: rgba(var(--bg-success-color-rgb, 86, 211, 100), 0.15);
    color: var(--fg-success-color);
  }
  &.level-medium {
    background-color: rgba(var(--bg-warning-color-rgb, 227, 179, 65), 0.15);
    color: var(--fg-warning-color);
  }
  &.level-hard {
    background-color: rgba(var(--bg-error-color-rgb, 248, 81, 73), 0.15);
    color: var(--fg-error-color);
  }
}

.srs-badge {
  font-size: 0.7rem;
  padding: 1px 5px;
  border: 1px solid currentColor;
  border-radius: 4px;
  font-weight: 500;
  opacity: 0.8;
}

.empty-state {
  text-align: center;
  margin-top: 60px;
  color: var(--fg-secondary-color);
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

  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    font-size: 1.25rem;
    color: var(--fg-secondary-color);
  }

  &:hover:not(:disabled) svg {
    color: var(--fg-accent-color);
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
