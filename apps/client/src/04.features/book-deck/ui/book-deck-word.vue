<script setup lang="ts">
import type { BookDeckWord } from '~/01.shared/types/schemas/book-deck.schema'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'

interface Props {
  entry: BookDeckWord
  selected: boolean
  busy: boolean
  current: boolean
  error?: string
}
defineProps<Props>()
const emit = defineEmits<{ select: [checked: boolean], generate: [] }>()
const { t } = useI18n()
</script>

<template>
  <article class="word-row">
    <div class="word-heading" :inert="busy">
      <KitCheckbox :model-value="selected" :label="entry.word" @update:model-value="emit('select', !!$event)" />
      <span>{{ t('bookDeck.occurrences', { count: entry.count }) }}</span>
      <span class="source">{{ t(`bookDeck.${entry.source}`) }}</span>
    </div>
    <p v-if="entry.content" class="translation">
      {{ entry.content.transcription }} {{ entry.content.translation }}
    </p>
    <p v-else>
      {{ t('bookDeck.noTranslation') }}
    </p>
    <details>
      <summary>{{ t('bookDeck.details') }} · {{ entry.forms.join(', ') }}</summary>
      <blockquote v-for="context in entry.contexts" :key="context.sentence">
        {{ context.sentence }} <small>{{ t('bookDeck.page', { page: context.page }) }}</small>
      </blockquote>
      <p v-if="entry.content?.grammarNote">
        {{ entry.content.grammarNote }}
      </p>
      <p v-if="entry.content?.vocabularyNote">
        {{ entry.content.vocabularyNote }}
      </p>
      <p v-if="entry.content?.difficulty || entry.content?.tags">
        {{ entry.content.difficulty }} {{ entry.content.tags }}
      </p>
    </details>
    <p v-if="error" role="alert" class="error">
      {{ error }}
    </p>
    <KitBtn
      size="sm"
      variant="text"
      :disabled="busy"
      :loading="current"
      @click="emit('generate')"
    >
      {{ t(entry.content ? 'bookDeck.regenerate' : 'bookDeck.generate') }}
    </KitBtn>
  </article>
</template>

<style scoped lang="scss">
.word-row {
  padding: 12px 0;
  border-bottom: 1px solid var(--border-secondary-color);
  overflow-wrap: anywhere;
}
.word-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.source,
small {
  opacity: 0.7;
}
.translation {
  font-weight: 500;
}
summary {
  cursor: pointer;
  opacity: 0.8;
}
blockquote {
  margin: 12px 0;
  padding-left: 12px;
  border-left: 2px solid var(--border-accent-color);
}
.error {
  color: var(--text-error-color, #d65959);
}
</style>
