<script setup lang="ts">
import type { BookDeckWord } from '~/01.shared/types/schemas/book-deck.schema'
import { isWordContentComplete, missingWordContentFields } from '@injurka/insight-book-language-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'

interface Props { entry: BookDeckWord, selected: boolean, busy: boolean, current: boolean, offline?: boolean, showGenerate?: boolean, error?: string }
const props = withDefaults(defineProps<Props>(), { showGenerate: true, offline: false })
const emit = defineEmits<{ select: [checked: boolean], generate: [], inspect: [] }>()
const { t } = useI18n()
const missingLabels = computed(() => missingWordContentFields(props.entry.content).map(field => t(`bookDeck.requiredFields.${field}`)).join(', '))
</script>

<template>
  <article class="word-row" :class="{ 'is-current': current, 'is-selected': selected }">
    <div class="word-main">
      <div class="word-selection" :inert="busy">
        <KitCheckbox :model-value="selected" :label="entry.word" @update:model-value="emit('select', !!$event)" />
      </div>
      <div class="word-meaning">
        <span :class="{ muted: !entry.content }">{{ entry.content?.translation || t('bookDeck.noTranslation') }}</span><small v-if="error" role="alert" class="error">{{ error }}</small>
      </div>
      <span class="word-count" :title="t('bookDeck.occurrences', { count: entry.count })">{{ entry.count }}×</span>
      <div class="word-data">
        <span class="word-source" :class="{ missing: entry.source === 'missing' }">{{ t(entry.source === 'missing' ? 'bookDeck.noData' : `bookDeck.${entry.source}`) }}</span>
        <small v-if="entry.content && missingLabels" class="completion-hint">{{ t('bookDeck.needsCompletion', { fields: missingLabels }) }}</small>
      </div>
      <div class="word-actions">
        <KitBtn
          v-if="showGenerate && !isWordContentComplete(entry.content)"
          icon="mdi:creation"
          size="sm"
          variant="tonal"
          :disabled="busy || offline"
          :loading="current"
          :aria-label="t('bookDeck.generateWord', { word: entry.word })"
          :title="t('bookDeck.generate')"
          @click="emit('generate')"
        />
        <KitBtn
          icon="mdi:text-box-search-outline"
          size="sm"
          variant="text"
          :aria-label="t('bookDeck.inspectWord', { word: entry.word })"
          :title="t('bookDeck.details')"
          @click="emit('inspect')"
        />
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.word-row {
  padding: 13px 18px;
  border-bottom: 1px solid var(--border-secondary-color);
  transition: background 0.15s ease;
}
.word-row:last-child {
  border-bottom: 0;
}
.word-row:hover,
.word-row.is-current {
  background: var(--bg-secondary-color);
}
.word-row.is-selected {
  background: color-mix(in srgb, var(--fg-accent-color) 5%, var(--bg-primary-color));
}
.word-row.is-current {
  background: var(--bg-accent-color);
  box-shadow: inset 3px 0 0 var(--fg-accent-color);
}
.word-main {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(140px, 1.5fr) 66px 132px 76px;
  align-items: center;
  gap: 12px;
}
.word-selection {
  min-width: 0;
  font-weight: 600;
  font-size: 0.88rem;
  overflow-wrap: anywhere;
}
.word-selection :deep(.kit-checkbox) {
  width: 100%;
  padding: 3px 0;
  align-items: flex-start;
}
.word-selection :deep(.checkbox-label) {
  font-size: 0.88rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  min-width: 0;
}
.word-selection :deep(.checkbox-box) {
  margin-top: 2px;
}
.word-meaning {
  min-width: 0;
  display: grid;
  gap: 4px;
  font-size: 0.83rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.word-meaning > span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.muted {
  color: var(--fg-secondary-color);
}
.word-count {
  color: var(--fg-secondary-color);
  text-align: right;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
.word-data {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.completion-hint {
  color: var(--fg-secondary-color);
  font-size: 0.64rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.word-source {
  justify-self: start;
  padding: 4px 7px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 6px;
  color: var(--fg-secondary-color);
  font-size: 0.65rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  max-width: 100%;
}
.word-source.missing {
  border-style: dashed;
}
.word-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}
.error {
  color: var(--text-error-color, #c33737);
  font-size: 0.72rem;
}
@media (max-width: 1200px) and (min-width: 961px) {
  .word-main {
    grid-template-columns: minmax(100px, 1fr) minmax(100px, 1.2fr) 50px 100px 70px;
    gap: 8px;
  }
  .word-row {
    padding-inline: 14px;
  }
}
@media (max-width: 680px) {
  .word-row {
    padding: 13px 14px;
  }
  .word-main {
    grid-template-columns: minmax(0, 1fr) auto 72px;
    gap: 7px 10px;
  }
  .word-selection {
    grid-area: 1 / 1;
  }
  .word-count {
    grid-area: 1 / 2;
  }
  .word-actions {
    grid-area: 1 / 3 / 3 / 4;
    align-self: center;
  }
  .word-meaning {
    grid-area: 2 / 1 / 3 / 3;
    padding-left: 26px;
  }
  .word-data {
    grid-area: 3 / 1 / 4 / 3;
    margin-left: 26px;
  }
  .word-actions :deep(.kit-btn) {
    width: 34px;
    min-width: 34px;
    height: 38px;
    padding: 0;
  }
}
</style>
