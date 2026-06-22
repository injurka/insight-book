<script setup lang="ts">
import type { GeneratedWordExamples } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitDialog, KitSkeleton } from '~/components/01.kit'

defineProps<{
  loading?: boolean
  data?: GeneratedWordExamples | null
}>()

const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="t('analysis.aiContextAndExamples')"
    :max-width="650"
    :floating="false"
    :minimizable="false"
    z-index="1400"
  >
    <div v-if="loading" class="ai-loading">
      <KitSkeleton width="100%" height="24px" class="mb-3" />
      <KitSkeleton width="80%" height="24px" class="mb-3" />
      <KitSkeleton width="100%" height="150px" />
      <p style="text-align: center; color: var(--fg-secondary-color); margin-top: 12px; font-style: italic;">
        {{ t('analysis.generatingContext') }}
      </p>
    </div>

    <div v-else-if="data" class="ai-results">
      <!-- Новый блок лексики -->
      <div v-if="data.vocabulary && data.vocabulary.length" class="ai-section">
        <div class="ai-section-title">
          <Icon icon="mdi:book-open-page-variant-outline" /> {{ t('analysis.vocabulary') }}
        </div>
        <ul class="ai-list">
          <template v-for="(voc, i) in data.vocabulary" :key="i">
            <li v-if="voc && voc.word">
              <b>{{ voc.word }}</b> <span v-if="voc.transcription">({{ voc.transcription }})</span> — {{ voc.meaning }}
            </li>
          </template>
        </ul>
      </div>

      <div v-if="data.mnemonics" class="ai-section">
        <div class="ai-section-title">
          <Icon icon="mdi:lightbulb-on-outline" /> {{ t('analysis.mnemonics') }}
        </div>
        <p class="ai-text">
          {{ data.mnemonics }}
        </p>
      </div>

      <div v-if="data.grammar_note" class="ai-section">
        <div class="ai-section-title">
          <Icon icon="mdi:book-open-variant" /> {{ t('analysis.grammar') }}
        </div>
        <p class="ai-text">
          {{ data.grammar_note }}
        </p>
      </div>

      <div v-if="data.examples && data.examples.length" class="ai-section">
        <div class="ai-section-title">
          <Icon icon="mdi:format-list-bulleted" /> {{ t('analysis.examples') }}
        </div>
        <ul class="ai-list">
          <li v-for="(ex, i) in data.examples" :key="i">
            <span class="ex-type">{{ ex.type }}</span>
            <div class="ex-orig">
              {{ ex.original }}
            </div>
            <div class="ex-transc">
              {{ ex.transcription }}
            </div>
            <div class="ex-transl">
              {{ ex.translation }}
            </div>
            <div class="ex-literal">
              {{ t('analysis.literalTranslation') }}: {{ ex.literal_translation }}
            </div>
          </li>
        </ul>
      </div>

      <div v-if="data.collocations && data.collocations.length" class="ai-section">
        <div class="ai-section-title">
          <Icon icon="mdi:link-variant" /> {{ t('analysis.collocations') }}
        </div>
        <ul class="ai-list">
          <li v-for="(col, i) in data.collocations" :key="i">
            <b>{{ col.original }}</b> ({{ col.transcription }}) — {{ col.translation }}
          </li>
        </ul>
      </div>

      <div v-if="data.relations && (data.relations.synonyms?.length || data.relations.antonyms?.length)" class="ai-section relations-section">
        <div v-if="data.relations.synonyms?.length">
          <div class="ai-section-title">
            <Icon icon="mdi:swap-horizontal" /> {{ t('analysis.synonyms') }}
          </div>
          <ul class="ai-list">
            <li v-for="(syn, i) in data.relations.synonyms" :key="i">
              <b>{{ syn.word }}</b> ({{ syn.transcription }}) — {{ syn.translation }}
            </li>
          </ul>
        </div>

        <div v-if="data.relations.antonyms?.length" :style="data.relations.synonyms?.length ? 'margin-top: 16px;' : ''">
          <div class="ai-section-title">
            <Icon icon="mdi:swap-horizontal-bold" /> {{ t('analysis.antonyms') }}
          </div>
          <ul class="ai-list">
            <li v-for="(ant, i) in data.relations.antonyms" :key="i">
              <b>{{ ant.word }}</b> ({{ ant.transcription }}) — {{ ant.translation }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.ai-results {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 8px;
}
.ai-section {
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 8px;
  padding: 12px;
}
.ai-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-accent-color);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.ai-text {
  margin: 0;
  font-size: 0.95rem;
  color: var(--fg-primary-color);
  line-height: 1.5;
}
.ai-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;

  li {
    border-bottom: 1px dashed var(--border-primary-color);
    padding-bottom: 12px;
    &:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
  }

  .ex-type {
    display: inline-block;
    background: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    font-size: 0.75rem;
    padding: 2px 6px;
    border-radius: 4px;
    margin-bottom: 4px;
  }
  .ex-orig {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--fg-primary-color);
  }
  .ex-transc {
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    margin-bottom: 4px;
  }
  .ex-transl {
    font-size: 0.95rem;
    color: var(--fg-primary-color);
  }
  .ex-literal {
    font-size: 0.85rem;
    color: var(--fg-muted-color);
    font-style: italic;
    margin-top: 4px;
  }
}
.relations-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
  b {
    color: var(--fg-primary-color);
  }
}
.mb-3 {
  margin-bottom: 12px;
}
</style>
