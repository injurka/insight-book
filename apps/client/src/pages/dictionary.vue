<script setup lang="ts">
import { KitBtn, KitSkeleton } from '~/components/01.kit'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useDictionaryStore } from '~/shared/store/dictionary.store'

const store = useDictionaryStore()
const router = useRouter()

onMounted(() => {
  store.fetchDictionary()
})
</script>

<template>
  <div class="dict-page">
    <header class="dict-header">
      <div class="header-left">
        <KitBtn icon="mdi:arrow-left" variant="text" @click="router.push(AppRoutePaths.Home)" />
        <div class="header-title">
          <h1>Мой словарь</h1>
          <p>Слова, которые вы добавили</p>
        </div>
      </div>
      <div class="header-right" />
    </header>

    <div v-if="store.isLoading" class="dict-loading">
      <KitSkeleton v-for="i in 5" :key="i" width="100%" height="80px" class="mb-3" />
    </div>

    <div v-else-if="store.filteredWords.length === 0" class="empty-dict">
      <h2>Словарь пуст</h2>
      <p>Вы пока не добавили ни одного слова. Начните читать, чтобы пополнить свой словарный запас!</p>
    </div>

    <div v-else class="dict-list">
      <div v-for="item in store.filteredWords" :key="item.id" class="dict-item">
        <div class="dict-item-content">
          <div class="dict-word">
            <span class="hanzi">{{ item.word }}</span>
            <span class="pinyin">{{ item.pinyin }}</span>
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
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  flex-wrap: wrap;
  gap: 16px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-title h1 {
    font-size: 2rem;
    margin: 0;
  }

  .header-title p {
    margin: 0;
    color: var(--fg-secondary-color);
  }

  .header-right {
    min-width: 250px;
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

  .dict-word {
    margin-bottom: 6px;
    .hanzi {
      font-size: 1.4rem;
      font-weight: bold;
      margin-right: 12px;
      color: var(--fg-accent-color);
    }
    .pinyin {
      font-size: 1rem;
      color: var(--fg-secondary-color);
    }
  }

  .dict-translation {
    font-size: 1rem;
    color: var(--fg-primary-color);
    line-height: 1.5;
  }

  .dict-notes {
    margin-top: 8px;
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
