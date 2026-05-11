<script setup lang="ts">
import { useVirtualList } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { KitBtn, KitInput } from '~/components/01.kit'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useDictionaryStore } from '../store/dictionary.store'

ё
const router = useRouter()

const search = ref('')

const filteredWords = computed(() => {
  const query = search.value.toLowerCase()
  if (!query)
    return store.words
  return store.words.filter(w => w.word.toLowerCase().includes(query) || (w.translation && w.translation.toLowerCase().includes(query)))
})

const { list, containerProps, wrapperProps } = useVirtualList(filteredWords, {
  itemHeight: 110, 
})

onMounted(() => {
  store.fetchDictionary()
})
</script>

<template>
  <div class="dictionary-view">
    <header class="dict-header">
      <KitBtn icon="mdi:arrow-left" variant="text" @click="router.back()" />
      <div class="title-group">
        <h1>Мой словарь</h1>
        <span class="badge">{{ store.words.length }} слов</span>
      </div>
      <div class="spacer" />
      <KitInput v-model="search" placeholder="Поиск слова..." class="search-input" />
    </header>

    <div v-if="!store.words.length && !store.isLoading" class="empty-state">
      <p>Вы пока не добавили ни одного слова.</p>
    </div>

    <div v-else class="virtual-list-container" v-bind="containerProps">
      <div v-bind="wrapperProps" class="virtual-list-wrapper">
        <div v-for="item in list" :key="item.data.id" class="dict-item">
          <div class="dict-item-content">
            <div class="dict-word-container">
              <span class="dict-word">{{ item.data.word }}</span>
              <span class="dict-transcription">{{ item.data.transcription }}</span>
            </div>
            <div class="dict-translation" v-html="item.data.translation" />
          </div>
          <div class="dict-actions">
            <KitBtn icon="mdi:pencil" variant="text" size="xs" @click="analysisStore.wordToEdit = item.data; analysisStore.addEditWordModalOpen = true;" />
            <KitBtn icon="mdi:delete-outline" variant="text" size="xs" @click="store.deleteWord(item.data.word)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.dictionary-view {
  padding: 32px;
  max-width: 800px;
  margin: 0 auto;
  height: 100dvh;
  display: flex;
  flex-direction: column;
}
.dict-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  flex-shrink: 0;
  .title-group {
    display: flex;
    align-items: center;
    gap: 12px;
    h1 {
      margin: 0;
      font-size: 1.5rem;
    }
    .badge {
      background: var(--bg-tertiary-color);
      padding: 4px 10px;
      border-radius: 99px;
      font-size: 0.85rem;
    }
  }
  .spacer {
    flex-grow: 1;
  }
  .search-input {
    max-width: 300px;
  }
}
.virtual-list-container {
  flex-grow: 1;
  overflow-y: auto;
  padding-right: 8px;
}
.virtual-list-wrapper {
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
  border-radius: 8px;
  border: 1px solid var(--border-secondary-color);
  height: 98px; /* Фиксируем высоту для идеального virtual scroll */
  margin-bottom: 12px;
  overflow: hidden;

  .dict-item-content {
    flex-grow: 1;
    min-width: 0;
  }
  .dict-word-container {
    margin-bottom: 4px;
    .dict-word {
      font-size: 1.2rem;
      font-weight: bold;
      margin-right: 8px;
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
.empty-state {
  text-align: center;
  margin-top: 60px;
  color: var(--fg-secondary-color);
}
</style>
