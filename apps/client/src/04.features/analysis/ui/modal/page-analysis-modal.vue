<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { KitBtn, KitDialog } from '~/02.kit'

const analysisStore = useAnalysisStore()
const { t } = useI18n()
</script>

<template>
  <KitDialog
    v-model:visible="analysisStore.isPageAnalysisModalOpen"
    :title="t('analysis.pageAnalysis')"
    icon="mdi:robot-outline"
    :max-width="450"
    :persistent="!analysisStore.isPageAnalysisFinished"
  >
    <template v-if="!analysisStore.isPageAnalysisFinished">
      <div class="analysis-steps">
        <div v-if="analysisStore.pageAnalysisSentencesTotal > 0" class="progress-card">
          <div class="progress-header">
            <span class="label-group">
              <Icon icon="mdi:text-short" class="step-icon pulse-animation" />
              {{ t('analysis.sentences') }}
            </span>
            <span class="progress-values">
              <b>{{ analysisStore.pageAnalysisSentencesCurrent }}</b> {{ t('bookStats.outOf') }} {{ analysisStore.pageAnalysisSentencesTotal }}
            </span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${analysisStore.pageAnalysisSentencesTotal > 0 ? (analysisStore.pageAnalysisSentencesCurrent / analysisStore.pageAnalysisSentencesTotal) * 100 : 0}%` }" />
          </div>
        </div>

        <div v-if="analysisStore.pageAnalysisWordsTotal > 0" class="progress-card">
          <div class="progress-header">
            <span class="label-group">
              <Icon icon="mdi:format-text" class="step-icon pulse-animation" />
              {{ t('analysis.words') }}
            </span>
            <span class="progress-values">
              <b>{{ analysisStore.pageAnalysisWordsCurrent }}</b> {{ t('bookStats.outOf') }} {{ analysisStore.pageAnalysisWordsTotal }}
            </span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${analysisStore.pageAnalysisWordsTotal > 0 ? (analysisStore.pageAnalysisWordsCurrent / analysisStore.pageAnalysisWordsTotal) * 100 : 0}%` }" />
          </div>
        </div>

        <div v-if="analysisStore.pageAnalysisTtsTotal > 0" class="progress-card">
          <div class="progress-header">
            <span class="label-group">
              <Icon icon="mdi:headphones" class="step-icon pulse-animation" />
              {{ t('analysis.voiceProgress') }}
            </span>
            <span class="progress-values">
              <b>{{ analysisStore.pageAnalysisTtsCurrent }}</b> {{ t('bookStats.outOf') }} {{ analysisStore.pageAnalysisTtsTotal }}
            </span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill tts-fill" :style="{ width: `${analysisStore.pageAnalysisTtsTotal > 0 ? (analysisStore.pageAnalysisTtsCurrent / analysisStore.pageAnalysisTtsTotal) * 100 : 0}%` }" />
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="finished-state">
        <Icon icon="mdi:checkbox-marked-circle-outline" class="success-icon" />
        <div class="success-text">
          <h4>{{ t('analysis.done') }}</h4>
          <p>{{ t('analysis.allElementsAnalyzed') }}</p>
        </div>
      </div>
    </template>

    <template #footer>
      <template v-if="!analysisStore.isPageAnalysisFinished">
        <KitBtn color="secondary" variant="outlined" @click="analysisStore.cancelPageAnalysis()">
          {{ t('analysis.cancel') }}
        </KitBtn>
        <div style="flex-grow: 1" />
        <KitBtn color="primary" variant="tonal" @click="analysisStore.isPageAnalysisModalOpen = false">
          {{ t('analysis.toBackground') }}
        </KitBtn>
      </template>
      <template v-else>
        <KitBtn color="primary" style="width: 100%;" @click="analysisStore.isPageAnalysisModalOpen = false">
          {{ t('analysis.excellent') }}
        </KitBtn>
      </template>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
.analysis-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 0;
}

.progress-card {
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .label-group {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--fg-primary-color);

      .step-icon {
        font-size: 1.3rem;
        color: var(--fg-accent-color);
      }
    }

    .progress-values {
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
      font-variant-numeric: tabular-nums;

      b {
        color: var(--fg-primary-color);
        font-size: 0.95rem;
      }
    }
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background-color: var(--bg-primary-color);
    border-radius: 3px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      background-color: var(--fg-accent-color);
      border-radius: 3px;
      transition: width 0.3s ease;

      &.tts-fill {
        background-color: var(--fg-info-color);
      }
    }
  }
}

.finished-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 0;
  text-align: center;

  .success-icon {
    font-size: 4rem;
    color: var(--fg-success-color);
  }

  .success-text {
    h4 {
      margin: 0 0 6px 0;
      font-size: 1.25rem;
      color: var(--fg-primary-color);
      font-weight: 600;
    }

    p {
      margin: 0;
      color: var(--fg-secondary-color);
      font-size: 0.95rem;
      line-height: 1.4;
    }
  }
}

.pulse-animation {
  animation: pulse-micro 2s ease-in-out infinite;
}

@keyframes pulse-micro {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(0.9);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
