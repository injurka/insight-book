<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitDialog, KitSkeleton } from '~/components/01.kit'
import { useBooksStore } from '~/shared/store/books.store'

const store = useBooksStore()
</script>

<template>
  <KitDialog v-model:visible="store.sidebarOpen" title="Анализ ИИ" :max-width="650" icon="mdi:robot-outline">
    <div v-if="store.isAnalyzing" class="analysis-loading">
      <KitSkeleton width="100%" height="20px" class="mb-3" />
      <KitSkeleton width="80%" height="20px" class="mb-3" />
      <KitSkeleton width="90%" height="20px" />
      <p class="loading-text">
        Анализ...
      </p>
    </div>

    <div v-else-if="store.sidebarAnalysis" class="analysis-content">
      <div class="original-sentence">
        {{ store.sidebarSentence }}
      </div>

      <div class="analysis-block">
        <h3><Icon icon="mdi:translate" class="inline-icon" /> Перевод</h3>
        <p class="translation-text">
          {{ store.sidebarAnalysis.translation }}
        </p>
      </div>

      <div v-if="store.sidebarAnalysis.grammarRules?.length" class="analysis-block">
        <h3><Icon icon="mdi:puzzle-outline" class="inline-icon" /> Грамматика</h3>
        <div v-for="(rule, idx) in store.sidebarAnalysis.grammarRules" :key="idx" class="grammar-card">
          <div class="rule-pattern">
            {{ rule.pattern }}
          </div>
          <div class="rule-exp">
            {{ rule.explanation }}
          </div>
          <div v-if="rule.example" class="rule-ex">
            Пример: {{ rule.example }}
          </div>
        </div>
      </div>

      <div v-if="store.sidebarAnalysis.vocabulary?.length" class="analysis-block">
        <h3><Icon icon="mdi:book-open-page-variant-outline" class="inline-icon" /> Лексика</h3>
        <ul class="vocab-list">
          <li v-for="(v, idx) in store.sidebarAnalysis.vocabulary" :key="idx">
            <div class="vocab-word">
              <span class="hanzi">{{ v.word }}</span>
              <span class="pinyin">{{ v.pinyin }}</span>
            </div>
            <div class="vocab-meaning">
              {{ v.meaning }}
            </div>
            <div v-if="v.usageInContext" class="vocab-context">
              Контекст: {{ v.usageInContext }}
            </div>
          </li>
        </ul>
      </div>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.analysis-loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px 0;
  text-align: center;

  .loading-text {
    margin-top: 16px;
    color: var(--fg-secondary-color);
    font-style: italic;
  }
}

.analysis-content {
  .original-sentence {
    font-size: 1.3rem;
    font-weight: 500;
    margin-bottom: 24px;
    padding: 16px;
    background-color: var(--bg-tertiary-color);
    border-left: 4px solid var(--fg-accent-color);
    border-radius: 4px 8px 8px 4px;
    font-family: 'Maple Mono CN', sans-serif;
  }

  .analysis-block {
    margin-bottom: 24px;
    h3 {
      font-size: 1.1rem;
      margin-bottom: 12px;
      color: var(--fg-accent-color);
      display: flex;
      align-items: center;
      gap: 8px;
      .inline-icon {
        font-size: 1.3rem;
      }
    }
  }

  .translation-text {
    font-size: 1.05rem;
    line-height: 1.5;
  }

  .grammar-card {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 12px;
    .rule-pattern {
      font-weight: bold;
      color: var(--fg-primary-color);
      margin-bottom: 4px;
    }
    .rule-exp {
      font-size: 0.95rem;
      color: var(--fg-secondary-color);
      margin-bottom: 6px;
    }
    .rule-ex {
      font-size: 0.9rem;
      font-style: italic;
      color: var(--fg-muted-color);
    }
  }

  .vocab-list {
    list-style: none;
    padding: 0;
    margin: 0;
    li {
      padding: 12px 0;
      border-bottom: 1px dashed var(--border-secondary-color);
      &:last-child {
        border-bottom: none;
      }
      .vocab-word {
        margin-bottom: 4px;
        .hanzi {
          font-weight: bold;
          font-size: 1.15rem;
          margin-right: 8px;
        }
        .pinyin {
          color: var(--fg-accent-color);
          font-size: 0.9rem;
        }
      }
      .vocab-meaning {
        font-size: 0.95rem;
        margin-bottom: 4px;
      }
      .vocab-context {
        font-size: 0.85rem;
        color: var(--fg-secondary-color);
      }
    }
  }
}
</style>
