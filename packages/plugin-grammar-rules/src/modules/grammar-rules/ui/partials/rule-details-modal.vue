<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatMarkdown } from '~/01.shared/lib/markdown'
import { KitBtn, KitDialog } from '~/02.kit'
import type { Rule } from '../../../../shared/types'

interface Props {
  rule: Rule | null
  explanation: string
  loading: boolean
  error?: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'regenerate'): void
}>()

const visible = defineModel<boolean>('visible', { required: true })
const { t, te } = useI18n()

const categoryLabel = (cat?: string) => {
  if (!cat)
    return ''
  const i18nKey = `plugins.grammar-rules.cat_${cat}`
  if (te(i18nKey))
    return t(i18nKey)

  switch (cat) {
    case 'grammar': return t('plugins.grammar-rules.catGrammar')
    case 'tenses': return t('plugins.grammar-rules.catTenses')
    case 'modals': return t('plugins.grammar-rules.catModals')
    case 'conditionals': return t('plugins.grammar-rules.catConditionals')
    case 'passive': return t('plugins.grammar-rules.catPassive')
    case 'articles': return t('plugins.grammar-rules.catArticles')
    case 'lexical': return t('plugins.grammar-rules.catLexical')
    case 'collocation': return t('plugins.grammar-rules.catCollocation')
    case 'measure_words': return t('plugins.grammar-rules.catMeasureWords')
    default: return cat
  }
}

const formattedExplanation = computed(() => {
  return formatMarkdown(props.explanation || '')
})
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="rule?.title || t('plugins.grammar-rules.ruleDetailsModalTitle')"
    icon="mdi:book-open-page-variant-outline"
    :max-width="760"
  >
    <div v-if="rule" class="rule-details-container">
      <!-- Rule Meta Header -->
      <div class="rule-quick-info">
        <div class="meta-badges">
          <span class="category-badge" :class="rule.category">
            {{ categoryLabel(rule.category) }}
          </span>
          <span class="level-badge">
            {{ (rule.level || rule.hskLevel || '').toUpperCase() }}
          </span>
        </div>

        <div v-if="rule.pattern" class="pattern-box">
          <span class="pattern-label">{{ t('plugins.grammar-rules.patternLabel') }}:</span>
          <code class="pattern-code">{{ rule.pattern }}</code>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="explanation-loading">
        <div class="loading-spinner">
          <Icon icon="mdi:loading" class="spin-icon" />
        </div>
        <p class="loading-title">
          {{ t('plugins.grammar-rules.generatingExplanation') }}
        </p>
        <p class="loading-subtitle">
          {{ t('plugins.grammar-rules.generatingExplanationHint') }}
        </p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="explanation-error">
        <Icon icon="mdi:alert-circle-outline" class="error-icon" />
        <p class="error-text">
          {{ error }}
        </p>
        <KitBtn
          size="sm"
          color="accent"
          variant="tonal"
          icon="mdi:refresh"
          @click="emit('regenerate')"
        >
          {{ t('plugins.grammar-rules.regenerateExplanation') }}
        </KitBtn>
      </div>

      <!-- Content Area -->
      <div v-else-if="explanation" class="explanation-content">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="markdown-body" v-html="formattedExplanation" />
      </div>
    </div>

    <template #footer>
      <div class="modal-footer-actions">
        <KitBtn
          size="sm"
          variant="outlined"
          color="secondary"
          :loading="loading"
          icon="mdi:refresh"
          @click="emit('regenerate')"
        >
          {{ t('plugins.grammar-rules.regenerateExplanation') }}
        </KitBtn>
        <div class="footer-spacer" />
        <KitBtn
          size="sm"
          variant="tonal"
          color="primary"
          @click="visible = false"
        >
          {{ t('plugins.grammar-rules.closeModal') }}
        </KitBtn>
      </div>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
.rule-details-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 12px 0;
  max-height: 72vh;
  overflow-y: auto;
}

.rule-quick-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background-color: var(--bg-tertiary-color);
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--border-primary-color);
}

.meta-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background-color: rgba(100, 100, 255, 0.15);
  color: var(--fg-accent-color);
}

.level-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  border: 1px solid var(--border-secondary-color);
}

.pattern-box {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .pattern-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
  }

  .pattern-code {
    background-color: var(--bg-primary-color);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--fg-accent-color);
    font-family: monospace;
    border: 1px solid var(--border-primary-color);
  }
}

.explanation-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  gap: 12px;

  .spin-icon {
    font-size: 2.5rem;
    color: var(--fg-accent-color);
    animation: spin 1s linear infinite;
  }

  .loading-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0;
  }

  .loading-subtitle {
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    margin: 0;
    max-width: 400px;
  }
}

.explanation-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  gap: 12px;

  .error-icon {
    font-size: 2.5rem;
    color: var(--fg-error-color);
  }

  .error-text {
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    margin: 0;
  }
}

.explanation-content {
  line-height: 1.65;
  color: var(--fg-primary-color);
  font-size: 0.95rem;

  :deep(.markdown-body) {
    h1, h2, h3, h4 {
      color: var(--fg-primary-color);
      font-weight: 700;
      line-height: 1.35;
    }

    h1 {
      font-size: 1.3rem;
      border-bottom: 1px solid var(--border-secondary-color);
      padding-bottom: 6px;
      margin-top: 22px;
      margin-bottom: 12px;
    }

    h2 {
      font-size: 1.15rem;
      border-bottom: 1px solid var(--border-secondary-color);
      padding-bottom: 4px;
      margin-top: 20px;
      margin-bottom: 10px;
    }

    h3 {
      font-size: 1.02rem;
      margin-top: 16px;
      margin-bottom: 8px;
    }

    h4 {
      font-size: 0.95rem;
      margin-top: 14px;
      margin-bottom: 6px;
    }

    hr {
      border: none;
      border-top: 1px solid var(--border-primary-color);
      margin: 20px 0;
      opacity: 0.6;
    }

    p {
      margin: 8px 0;
    }

    ul {
      list-style-type: disc;
      padding-left: 20px;
      margin: 8px 0;
    }

    ol {
      list-style-type: decimal;
      padding-left: 20px;
      margin: 8px 0;
    }

    li {
      margin: 4px 0;
    }

    strong {
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    em {
      font-style: italic;
    }

    blockquote {
      margin: 12px 0;
      padding: 8px 14px;
      border-left: 3px solid var(--fg-accent-color);
      background-color: var(--bg-tertiary-color);
      border-radius: 0 6px 6px 0;
      color: var(--fg-secondary-color);
    }

    table,
    .markdown-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 0.9rem;
      background-color: var(--bg-tertiary-color);
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border-primary-color);

      th, td {
        padding: 8px 12px;
        text-align: left;
        border: 1px solid var(--border-primary-color);
        vertical-align: top;
      }

      th {
        background-color: var(--bg-primary-color);
        font-weight: 600;
        color: var(--fg-primary-color);
      }

      tr:nth-child(even) {
        background-color: rgba(255, 255, 255, 0.02);
      }
    }

    code {
      background-color: var(--bg-tertiary-color);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.88em;
      color: var(--fg-accent-color);
      font-family: monospace;
    }

    pre {
      background-color: var(--bg-tertiary-color);
      padding: 12px 14px;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid var(--border-primary-color);

      code {
        background: transparent;
        padding: 0;
      }
    }
  }
}

.modal-footer-actions {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 12px;
}

.footer-spacer {
  flex-grow: 1;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
