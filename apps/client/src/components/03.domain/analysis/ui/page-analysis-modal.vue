<script setup lang="ts">
import { KitBtn } from '~/components/01.kit'
import { useAnalysisStore } from '~/shared/store/analysis.store'

const analysisStore = useAnalysisStore()
</script>

<template>
  <Transition name="fade">
    <div v-if="analysisStore.isAnalyzingPage" class="page-analysis-overlay">
      <div class="analysis-dialog">
        <h3>Анализ страницы</h3>

        <template v-if="!analysisStore.isPageAnalysisFinished">
          <div v-if="analysisStore.pageAnalysisMode === 'sentences' || analysisStore.pageAnalysisMode === 'all'" class="progress-section">
            <p>Предложения: <b>{{ analysisStore.pageAnalysisSentencesCurrent }}</b> из <b>{{ analysisStore.pageAnalysisSentencesTotal }}</b></p>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${analysisStore.pageAnalysisSentencesTotal > 0 ? (analysisStore.pageAnalysisSentencesCurrent / analysisStore.pageAnalysisSentencesTotal) * 100 : 0}%` }" />
            </div>
          </div>

          <div v-if="analysisStore.pageAnalysisMode === 'words' || analysisStore.pageAnalysisMode === 'all'" class="progress-section">
            <p>Слова: <b>{{ analysisStore.pageAnalysisWordsCurrent }}</b> из <b>{{ analysisStore.pageAnalysisWordsTotal }}</b></p>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${analysisStore.pageAnalysisWordsTotal > 0 ? (analysisStore.pageAnalysisWordsCurrent / analysisStore.pageAnalysisWordsTotal) * 100 : 0}%` }" />
            </div>
          </div>

          <KitBtn color="secondary" variant="outlined" style="margin-top: 8px;" @click="analysisStore.closePageAnalysisModal()">
            Отмена
          </KitBtn>
        </template>

        <template v-else>
          <div class="finished-state">
            <p><b>Анализ успешно завершен!</b></p>
            <p>Все элементы обработаны и сохранены в локальный кэш для оффлайн работы.</p>
          </div>
          <KitBtn color="primary" @click="analysisStore.closePageAnalysisModal()">
            Закрыть
          </KitBtn>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.page-analysis-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: var(--z-modal, 1200);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;

  .analysis-dialog {
    background-color: var(--bg-secondary-color);
    padding: 24px;
    border-radius: 12px;
    border: 1px solid var(--border-primary-color);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    text-align: center;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 16px;

    h3 {
      margin: 0;
      color: var(--fg-primary-color);
      font-size: 1.25rem;
    }

    .progress-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      text-align: left;

      p {
        margin: 0;
        color: var(--fg-secondary-color);
        font-size: 0.95rem;

        b {
          color: var(--fg-primary-color);
          font-variant-numeric: tabular-nums;
        }
      }

      .progress-bar {
        width: 100%;
        height: 8px;
        background-color: var(--bg-tertiary-color);
        border-radius: 4px;
        overflow: hidden;

        .progress-fill {
          height: 100%;
          background-color: var(--fg-accent-color);
          transition: width 0.3s ease;
        }
      }
    }

    .finished-state {
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: var(--fg-success-color);
      padding: 8px 0;

      b {
        font-size: 1.1rem;
      }

      p {
        margin: 0;
        color: var(--fg-secondary-color);
        font-size: 0.95rem;
      }
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
