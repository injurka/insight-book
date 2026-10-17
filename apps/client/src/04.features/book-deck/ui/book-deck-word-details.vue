<script setup lang="ts">
import type { BookDeckWord } from '~/01.shared/types/schemas/book-deck.schema'
import { isWordContentComplete, missingWordContentFields } from '@injurka/insight-book-language-utils'
import DOMPurify from 'dompurify'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'

interface Props { entry: BookDeckWord, busy: boolean, offline: boolean, showGenerate: boolean, current: string }
const props = defineProps<Props>()
const emit = defineEmits<{ generate: [] }>()
const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
const missingLabels = computed(() => missingWordContentFields(props.entry.content).map(field => t(`bookDeck.requiredFields.${field}`)).join(', '))
const forms = computed(() => {
  const seen = new Set([props.entry.word.toLocaleLowerCase()])

  return props.entry.forms.filter((form) => {
    const key = form.toLocaleLowerCase()

    if (seen.has(key))
      return false

    seen.add(key)

    return true
  })
})
function formatContent(content: string) {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'br', 'p', 'ul', 'ol', 'li', 'code', 'span'],
    ALLOWED_ATTR: [],
  })
}
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="entry.word"
    :max-width="640"
    :minimizable="false"
  >
    <div class="word-inspector">
      <div class="inspector-meta">
        <span>{{ t(`bookDeck.${entry.source}`) }}</span><span>{{ t('bookDeck.occurrences', { count: entry.count }) }}</span>
      </div>
      <p v-if="missingLabels" class="incomplete-notice" role="status">
        {{ t('bookDeck.missingFields', { fields: missingLabels }) }}
      </p>
      <section class="meaning-section">
        <div class="pronunciation-row">
          <p v-if="entry.content?.transcription" class="transcription">
            {{ entry.content.transcription }}
          </p>
          <span v-if="entry.content?.difficulty" class="difficulty-badge">{{ t('dictionary.difficulty') }}: <strong>{{ entry.content.difficulty }}</strong></span>
        </div>
        <div v-if="entry.content?.translation" class="translation" v-html="formatContent(entry.content.translation)" />
        <p v-else class="translation">
          {{ t('bookDeck.noTranslation') }}
        </p>
        <div v-if="forms.length" class="word-forms">
          <span class="forms-label">{{ t('bookDeck.wordForms') }}</span><span v-for="form in forms" :key="form" class="form-chip">{{ form }}</span>
        </div>
        <div v-if="entry.content?.tags" class="word-tags">
          {{ entry.content.tags }}
        </div>
      </section>
      <section v-if="entry.contexts.length" class="context-section">
        <h4>{{ t('bookDeck.contextsTitle') }}</h4>
        <blockquote v-for="context in entry.contexts" :key="`${context.page}:${context.sentence}`">
          <p>{{ context.sentence }}</p><cite>{{ t('bookDeck.page', { page: context.page }) }}</cite>
        </blockquote>
      </section>
      <section v-if="entry.content?.grammarNote || entry.content?.vocabularyNote" class="notes-section">
        <div v-if="entry.content.grammarNote" class="note-block">
          <h4>{{ t('dictionary.grammar') }}</h4><div class="formatted-content" v-html="formatContent(entry.content.grammarNote)" />
        </div>
        <div v-if="entry.content.vocabularyNote" class="note-block">
          <h4>{{ t('dictionary.vocabulary') }}</h4><div class="formatted-content" v-html="formatContent(entry.content.vocabularyNote)" />
        </div>
      </section>
    </div>
    <template #footer>
      <div class="inspector-actions">
        <KitBtn variant="text" @click="visible = false">
          {{ t('dictionary.done') }}
        </KitBtn>
        <KitBtn
          v-if="showGenerate"
          variant="tonal"
          prepend-icon="mdi:creation"
          :disabled="busy || offline"
          :loading="current === entry.word"
          @click="emit('generate')"
        >
          {{ t(isWordContentComplete(entry.content) ? 'bookDeck.regenerate' : 'bookDeck.completeData') }}
        </KitBtn>
      </div>
    </template>
  </KitDialog>
</template>

<style scoped lang="scss">
.incomplete-notice {
  margin: 0;
  padding: 10px 12px;
  border: 1px dashed var(--border-primary-color);
  border-radius: 8px;
  color: var(--fg-secondary-color);
  font-size: 0.78rem;
  line-height: 1.6;
}
.word-inspector {
  display: grid;
  gap: 20px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.inspector-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--fg-secondary-color);
  font-size: 0.76rem;
}
.inspector-meta span {
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--bg-secondary-color);
}
.translation {
  margin: 10px 0 14px;
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.5;
}
.transcription,
.word-forms {
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
}
.word-inspector h4 {
  margin: 0 0 10px;
  font-size: 0.85rem;
}
blockquote {
  margin: 0 0 10px;
  padding: 12px 14px;
  border-left: 3px solid var(--fg-accent-color);
  border-radius: 0 10px 10px 0;
  background: var(--bg-secondary-color);
}
blockquote p {
  margin: 0 0 5px;
  font-size: 0.88rem;
  line-height: 1.6;
}
blockquote cite {
  color: var(--fg-secondary-color);
  font-size: 0.72rem;
  font-style: normal;
}
.notes-section p {
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  line-height: 1.6;
}
.inspector-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.inspector-actions :deep(button) {
  white-space: normal;
  height: auto;
  min-height: 40px;
}

.pronunciation-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.difficulty-badge {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 9px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 7px;
  color: var(--fg-secondary-color);
  font-size: 0.74rem;
}
.difficulty-badge strong {
  color: var(--fg-primary-color);
}
.word-forms {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
}
.forms-label {
  margin-right: 3px;
  font-size: 0.72rem;
}
.form-chip {
  padding: 3px 7px;
  border-radius: 5px;
  background: var(--bg-secondary-color);
  font-size: 0.76rem;
}
.word-tags {
  margin-top: 10px;
  font-size: 0.74rem;
  color: var(--fg-secondary-color);
}
.notes-section {
  display: grid;
  gap: 16px;
  padding-top: 18px;
  border-top: 1px solid var(--border-secondary-color);
}
.formatted-content {
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  line-height: 1.65;
}
.formatted-content :deep(p),
.translation :deep(p) {
  margin: 0 0 8px;
}
.formatted-content :deep(p:last-child),
.translation :deep(p:last-child) {
  margin-bottom: 0;
}
.formatted-content :deep(ul),
.formatted-content :deep(ol) {
  margin: 8px 0;
  padding-left: 22px;
}
blockquote:last-child {
  margin-bottom: 0;
}
@media (max-width: 480px) {
  .pronunciation-row {
    justify-content: flex-start;
  }
  .translation {
    font-size: 1.05rem;
  }
}
</style>
