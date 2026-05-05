<script setup lang="ts">
import { KitBtn, KitInput, KitSelect, KitSkeleton } from '~/components/01.kit'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useDictionaryStore } from '~/shared/store/dictionary.store'

const store = useDictionaryStore()
const router = useRouter()

const langOptions = computed(() => {
  const opts = [{ label: 'Все языки', value: 'all' }]
  store.availableLanguages.forEach(l => opts.push({ label: l.toUpperCase(), value: l }))
  return opts
})

onMounted(() => {
  store.fetchDictionary()
})
</script>

<template>
  <div class="dict-page">
    <header class="dict-header">
      <div class="header-top">
        <div class="header-left">
          <KitBtn icon="mdi:arrow-left" variant="text" @click="router.push(AppRoutePaths.Home)" />
          <div class="header-title">
            <h1>Мой словарь</h1>
            <p>Слова, которые вы добавили</p>
          </div>
        </div>
      </div>

      <div class="header-bottom">
        <div class="filters">
          <KitInput v-model="store.searchTerm" placeholder="Поиск по словарю..." size="md" />
          <KitSelect v-model="store.selectedLanguage" :options="langOptions" size="md" />
        </div>
      </div>
    </header>

    <div v-if="store.isLoading" class="dict-loading">
      <KitSkeleton v-for="i in 5" :key="i" width="100%" height="80px" class="mb-3" />
    </div>

    <div v-else-if="store.words.length === 0" class="empty-dict">
      <h2>Словарь пуст</h2>
      <p>Вы пока не добавили ни одного слова. Начните читать, чтобы пополнить свой словарный запас!</p>
    </div>

    <div v-else-if="store.filteredWords.length === 0" class="empty-dict">
      <h2>Слова не найдены</h2>
      <p>По вашему запросу ничего не нашлось.</p>
    </div>

    <div v-else class="dict-list">
      <div v-for="item in store.filteredWords" :key="item.id" class="dict-item">
        <div class="dict-item-content">
          <div class="dict-word-container">
            <span class="dict-word">{{ item.word }}</span>
            <span class="dict-transcription">{{ item.transcription }}</span>
            <span class="lang-badge">{{ item.language.toUpperCase() }}</span>
          </div>
          <div class="dict-translation" v-html="item.translation" />
          <div v-if="item.notes" class="dict-notes">
            {{ item.notes }}
          </div>
          <div v-if="item.tags" class="dict-tags">
            <span v-for="tag in item.tags.split(',')" :key="tag" class="tag">{{ tag.trim() }}</span>
          </div>
        </div>
        <div class="dict-item-actions">
          <KitBtn icon="mdi:pencil" variant="text" size="sm" @click="store.openEditModal(item)" />
          <KitBtn icon="mdi:delete" variant="text" size="sm" @click="store.deleteWord(item.word)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dict-page {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100dvh;
}

.dict-header {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 32px;

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-title h1 {
      font-size: 2rem;
      margin: 0 0 4px 0;
    }

    .header-title p {
      margin: 0;
      color: var(--fg-secondary-color);
    }
  }

  .header-bottom {
    display: flex;

    .filters {
      display: flex;
      gap: 12px;
      width: 100%;
      max-width: 600px;
    }

    @include media-down(sm) {
      .filters {
        flex-direction: column;
        max-width: 100%;
      }
    }
  }
}

.empty-dict {
  text-align: center;
  padding: 64px 24px;
  background-color: var(--bg-secondary-color);
  border-radius: 16px;
  border: 1px dashed var(--border-primary-color);
}

.dict-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dict-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  background-color: var(--bg-secondary-color);
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--fg-accent-color);
  }

  .dict-item-content {
    flex-grow: 1;
  }

  .dict-word-container {
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;

    .dict-word {
      font-size: 1.4rem;
      font-weight: bold;
      color: var(--fg-accent-color);
    }
    .dict-transcription {
      font-size: 1rem;
      color: var(--fg-secondary-color);
    }
    .lang-badge {
      background: var(--bg-tertiary-color);
      color: var(--fg-secondary-color);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
  }

  .dict-translation {
    font-size: 1rem;
    color: var(--fg-primary-color);
    line-height: 1.5;
    white-space: pre-wrap;

    :deep(b) {
      font-weight: 600;
      color: var(--fg-primary-color);
    }
    :deep(.dict-pos) {
      color: var(--fg-success-color);
      font-style: italic;
      font-size: 0.9em;
      margin: 0 4px;
    }
    :deep(.dict-color) {
      color: var(--fg-info-color);
    }
    :deep(.dict-example) {
      color: var(--fg-secondary-color);
      display: block;
      margin-top: 4px;
      padding-left: 8px;
    }
    :deep(.dict-bullet) {
      display: block;
      margin-top: 6px;
    }
  }

  .dict-notes {
    margin-top: 12px;
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    font-style: italic;
    padding-left: 12px;
    border-left: 2px solid var(--border-primary-color);
  }

  .dict-tags {
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    .tag {
      font-size: 0.75rem;
      background-color: var(--bg-tertiary-color);
      color: var(--fg-secondary-color);
      padding: 2px 8px;
      border-radius: 99px;
    }
  }

  .dict-item-actions {
    display: flex;
    gap: 4px;
  }
}
</style>
