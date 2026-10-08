<script setup lang="ts">
import type { LexicalWordData } from '~/01.shared/types/models'
import { useI18n } from 'vue-i18n'

interface Props {
  words?: LexicalWordData[]
  tone?: string
}
const props = defineProps<Props>()
const emit = defineEmits<{ select: [word: LexicalWordData, event: MouseEvent] }>()
const { t } = useI18n()
</script>

<template>
  <div class="words">
    <button
      v-for="word in props.words"
      :key="word.word"
      type="button"
      class="word-chip"
      :class="props.tone"
      :title="[word.forms?.join(', '), word.pageCount ? t('bookLexical.pageSpread', { count: word.pageCount }) : ''].filter(Boolean).join(' · ')"
      @click.stop="emit('select', word, $event)"
    >
      {{ word.word }} <span class="count">{{ word.count }}</span>
    </button>
    <p v-if="!props.words?.length" class="empty">
      {{ t('bookLexical.emptyGroup') }}
    </p>
  </div>
</template>

<style lang="scss" scoped>
.words {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.word-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  overflow-wrap: anywhere;
  text-align: left;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--bg-primary-color);
  color: var(--fg-primary-color);
  border: 1px solid var(--border-primary-color);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  &:hover {
    background: var(--bg-hover-color);
  }
  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 2px;
  }
  &.noun {
    border-color: #3b82f6;
  }
  &.verb {
    border-color: #ef4444;
  }
  &.adj {
    border-color: #10b981;
  }
  &.entity {
    border-color: #8b5cf6;
  }
  &.rare {
    border-color: #f59e0b;
  }
}
.count {
  flex-shrink: 0;
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 12px;
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
}
.empty {
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  margin: 0;
}
</style>
