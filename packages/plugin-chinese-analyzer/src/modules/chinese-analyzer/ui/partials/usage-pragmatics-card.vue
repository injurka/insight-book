<script setup lang="ts">
import type { UsageContextInfo } from '../../model'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

interface Props {
  usageContext: UsageContextInfo
}

const props = defineProps<Props>()

const { t } = useI18n()

const formalitySteps = [1, 2, 3, 4, 5]
</script>

<template>
  <section class="usage-card">
    <header class="section-header">
      <div class="header-icon-box">
        <Icon icon="mdi:book-open-variant-outline" />
      </div>
      <div class="header-titles">
        <h3 class="section-title">
          {{ t('plugins.chinese-analyzer.usageSectionTitle') }}
        </h3>
        <p class="section-subtitle">
          {{ t('plugins.chinese-analyzer.usageSectionSubtitle') }}
        </p>
      </div>
    </header>

    <div class="usage-grid">
      <!-- When to use -->
      <div class="usage-panel">
        <span class="panel-kicker">{{ t('plugins.chinese-analyzer.whenToUseLabel') }}</span>
        <p class="panel-text">
          {{ props.usageContext.whenToUse }}
        </p>
      </div>

      <!-- Formality & Emotional Nuance -->
      <div class="usage-panel">
        <div class="formality-row">
          <span class="panel-kicker">{{ t('plugins.chinese-analyzer.formalityLabel') }}</span>
          <span class="formality-badge">{{ props.usageContext.formalityLabel }} ({{ props.usageContext.formalityScore }}/5)</span>
        </div>

        <div class="formality-meter">
          <span
            v-for="step in formalitySteps"
            :key="step"
            class="meter-bar"
            :class="{ filled: step <= props.usageContext.formalityScore }"
          />
        </div>

        <div class="nuance-sub">
          <span class="panel-kicker">{{ t('plugins.chinese-analyzer.emotionalNuanceLabel') }}</span>
          <p class="panel-text">
            {{ props.usageContext.emotionalNuance }}
          </p>
        </div>
      </div>
    </div>

    <!-- Cultural Note -->
    <div v-if="props.usageContext.culturalNote" class="cultural-note-banner">
      <div class="cn-title">
        <Icon icon="mdi:lightbulb-on-outline" />
        <span>{{ t('plugins.chinese-analyzer.culturalNoteLabel') }}</span>
      </div>
      <p>{{ props.usageContext.culturalNote }}</p>
    </div>

    <!-- Typical Situations Chips -->
    <div v-if="props.usageContext.typicalContexts.length > 0" class="situations-row">
      <span class="panel-kicker">{{ t('plugins.chinese-analyzer.typicalContextsLabel') }}:</span>
      <div class="situations-chips">
        <span
          v-for="(ctx, idx) in props.usageContext.typicalContexts"
          :key="`${ctx}_${idx}`"
          class="situation-chip"
        >
          <Icon icon="mdi:tag-outline" />
          <span>{{ ctx }}</span>
        </span>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.usage-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px;
  border-radius: 22px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 0;
    border-radius: 0;
    background: transparent;
    border: none;
    gap: 10px;
  }
}

.section-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;

  @include media-down(sm) {
    gap: 9px;
  }

  .header-icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: rgba(16, 185, 129, 0.14);
    color: #10b981;
    font-size: 1.35rem;
    flex-shrink: 0;

    @include media-down(sm) {
      width: 32px;
      height: 32px;
      border-radius: 9px;
      font-size: 1.1rem;
    }
  }

  .section-title {
    margin: 0 0 2px;
    font-size: 1.12rem;
    font-weight: 800;
    color: var(--fg-primary-color);

    @include media-down(sm) {
      font-size: 0.98rem;
    }
  }

  .section-subtitle {
    margin: 0;
    font-size: 0.82rem;
    color: var(--fg-secondary-color);

    @include media-down(sm) {
      font-size: 0.74rem;
    }
  }
}

.usage-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;

  @include media-down(md) {
    grid-template-columns: 1fr;
  }

  @include media-down(sm) {
    gap: 10px;
  }
}

.usage-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: 15px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 11px 12px;
    gap: 8px;
    border-radius: 13px;
    background: var(--bg-secondary-color);
  }
}

.panel-kicker {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--fg-secondary-color);
}

.panel-text {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
  color: var(--fg-primary-color);
}

.formality-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.formality-badge {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--fg-accent-color);
}

.formality-meter {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;

  .meter-bar {
    height: 7px;
    border-radius: 999px;
    background: var(--bg-tertiary-color);

    &.filled {
      background: linear-gradient(90deg, var(--fg-accent-color), #f59e0b);
    }
  }
}

.nuance-sub {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 4px;
}

.cultural-note-banner {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 15px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.28);

  .cn-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    font-weight: 800;
    color: #d97706;
  }

  p {
    margin: 0;
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--fg-primary-color);
  }
}

.situations-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.situations-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.situation-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 999px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}
</style>
