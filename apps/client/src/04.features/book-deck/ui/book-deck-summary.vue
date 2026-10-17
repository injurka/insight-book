<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

interface Props {
  selected: number
  ready: number
  missing: number
  hint: string
}
defineProps<Props>()
const { t, n } = useI18n()
</script>

<template>
  <aside class="deck-summary" :aria-label="t('bookDeck.summaryTitle')">
    <div class="summary-heading">
      <Icon icon="mdi:cards-outline" /><h2>{{ t('bookDeck.yourDeck') }}</h2>
    </div>
    <div class="selection-total">
      <strong>{{ n(selected) }}</strong><span>{{ t('bookDeck.selectedForDeck') }}</span>
    </div>
    <dl class="readiness">
      <div><dt><span class="status-dot ready" />{{ t('bookDeck.ready') }}</dt><dd>{{ n(ready) }}</dd></div>
      <div><dt><span class="status-dot missing" />{{ t('bookDeck.missing') }}</dt><dd>{{ n(missing) }}</dd></div>
    </dl>
    <p class="summary-hint" aria-live="polite">
      {{ hint }}
    </p>
    <div class="summary-actions">
      <slot /><slot name="secondary" />
    </div>
    <div class="progress-preserved">
      <Icon icon="mdi:shield-check-outline" /><span>{{ t('bookDeck.progressPreserved') }}</span>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.deck-summary {
  position: sticky;
  top: 20px;
  align-self: start;
  display: grid;
  gap: 20px;
  min-width: 0;
  padding: 22px;
  border: 1px solid var(--bg-tertiary-color);
  border-radius: 18px;
  background: var(--bg-secondary-color);
  box-shadow: 0 8px 28px rgba(var(--fg-primary-color-rgb), 0.04);
}
.summary-heading {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--fg-secondary-color);
}
.summary-heading h2 {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 600;
}
.selection-total {
  display: grid;
  gap: 4px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--fg-accent-color) 24%, var(--border-secondary-color));
  border-radius: 12px;
  background: var(--bg-primary-color);
}
.selection-total strong {
  color: var(--fg-primary-color);
  font-size: 2.35rem;
  line-height: 1.15;
  letter-spacing: -0.05em;
  font-variant-numeric: tabular-nums;
}
.selection-total span {
  color: var(--fg-secondary-color);
  font-size: 0.78rem;
}
.readiness {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 18px 0;
  border-block: 1px solid var(--border-secondary-color);
}
.readiness > div,
.readiness dt {
  display: flex;
  align-items: center;
  gap: 7px;
}
.readiness > div {
  justify-content: space-between;
  font-size: 0.78rem;
}
.readiness dt {
  color: var(--fg-secondary-color);
}
.readiness dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.status-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 50%;
  background: var(--fg-accent-color);
}
.status-dot.missing {
  background: var(--fg-secondary-color);
  opacity: 0.55;
}
.summary-hint {
  margin: 0;
  color: var(--fg-secondary-color);
  font-size: 0.78rem;
  line-height: 1.65;
}
.summary-actions {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.summary-actions :deep(.kit-btn) {
  width: 100%;
  min-height: 44px;
  height: auto;
  white-space: normal;
}
.progress-preserved {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: var(--fg-secondary-color);
  font-size: 0.7rem;
  line-height: 1.5;
}
.progress-preserved > :first-child {
  flex: 0 0 15px;
  margin-top: 2px;
  color: var(--fg-accent-color);
}
@media (max-width: 960px) {
  .deck-summary {
    position: fixed;
    inset: auto 0 0;
    z-index: 30;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
    border-radius: 0;
    border-width: 1px 0 0;
    background: var(--bg-secondary-color);
    box-shadow: 0 -5px 24px rgb(0 0 0 / 0.05);
    gap: 9px;
  }
  .summary-heading,
  .summary-hint,
  .progress-preserved {
    display: none;
  }
  .selection-total {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .selection-total strong {
    font-size: 0.9rem;
    letter-spacing: 0;
  }
  .selection-total span {
    font-size: 0.7rem;
  }
  .readiness {
    display: none;
  }
  .summary-actions {
    display: flex;
    flex-direction: row-reverse;
    gap: 8px;
  }
  .summary-actions :deep(.kit-btn) {
    flex: 1;
    min-width: 0;
    font-size: 0.8rem;
  }
}
</style>
