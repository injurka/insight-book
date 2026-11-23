<script setup lang="ts">
import type { AlternativeVariant } from '../../model'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

interface Props {
  alternatives: AlternativeVariant[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  speak: [text: string]
  analyzeVariant: [hanzi: string]
}>()

const { t } = useI18n()
</script>

<template>
  <section class="alternatives-section">
    <header class="section-header">
      <div class="header-icon-box">
        <Icon icon="mdi:swap-horizontal" />
      </div>
      <div class="header-titles">
        <h3 class="section-title">
          {{ t('plugins.chinese-analyzer.alternativesSectionTitle') }}
        </h3>
        <p class="section-subtitle">
          {{ t('plugins.chinese-analyzer.alternativesSectionSubtitle') }}
        </p>
      </div>
    </header>

    <div class="alternatives-grid">
      <article
        v-for="(alt, idx) in props.alternatives"
        :key="`${alt.hanzi}_${idx}`"
        class="alt-card"
      >
        <div class="alt-top">
          <span class="alt-register-badge">{{ alt.register }}</span>
          <div class="alt-top-actions">
            <button
              type="button"
              class="alt-icon-btn"
              @click="emit('speak', alt.hanzi)"
            >
              <Icon icon="mdi:volume-high" />
            </button>
          </div>
        </div>

        <div class="alt-main">
          <div class="alt-pinyin">
            {{ alt.pinyin }}
          </div>
          <div class="alt-hanzi">
            {{ alt.hanzi }}
          </div>
          <div class="alt-translation">
            {{ alt.translation }}
          </div>
        </div>

        <p v-if="alt.nuance" class="alt-nuance">
          {{ alt.nuance }}
        </p>

        <button
          type="button"
          class="analyze-alt-btn"
          @click="emit('analyzeVariant', alt.hanzi)"
        >
          <Icon icon="mdi:auto-fix" />
          <span>{{ t('plugins.chinese-analyzer.analyzeAlternativeBtn') }}</span>
        </button>
      </article>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.alternatives-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
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
    background: rgba(168, 85, 247, 0.14);
    color: #a855f7;
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

.alternatives-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;

  @include media-down(sm) {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}

.alt-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: 16px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--border-primary-color);
  }

  @include media-down(sm) {
    padding: 12px;
    gap: 8px;
    border-radius: 14px;
    background: var(--bg-secondary-color);
  }
}

.alt-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  .alt-register-badge {
    padding: 3px 10px;
    border-radius: 8px;
    font-size: 0.72rem;
    font-weight: 700;
    background: rgba(168, 85, 247, 0.13);
    color: #a855f7;
  }

  .alt-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--border-secondary-color);
    background: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
    cursor: pointer;

    &:hover {
      color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
    }
  }
}

.alt-main {
  display: flex;
  flex-direction: column;
  gap: 3px;

  .alt-pinyin {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--fg-accent-color);
  }

  .alt-hanzi {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--fg-primary-color);
    line-height: 1.3;
  }

  .alt-translation {
    font-size: 0.86rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.alt-nuance {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--fg-secondary-color);
}

.analyze-alt-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: auto;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
    background: rgba(var(--fg-accent-color-rgb), 0.08);
  }
}
</style>
