<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit'
import { useAnalysisStore } from '~/shared/store/analysis.store'

const analysisStore = useAnalysisStore()
</script>

<template>
  <Transition name="fade">
    <div v-if="analysisStore.isAnalyzingPage" class="page-analysis-overlay">
      <div class="analysis-dialog">
        <!-- Шапка окна с иконкой ИИ -->
        <div class="dialog-header">
          <Icon icon="mdi:robot-outline" class="title-icon" />
          <h3>Анализ страницы</h3>
        </div>

        <!-- Состояние обработки -->
        <template v-if="!analysisStore.isPageAnalysisFinished">
          <div class="analysis-steps">
            <!-- Карточка предложений -->
            <div
              v-if="analysisStore.pageAnalysisMode === 'sentences' || analysisStore.pageAnalysisMode === 'all'"
              class="progress-card"
            >
              <div class="progress-header">
                <span class="label-group">
                  <Icon icon="mdi:text-short" class="step-icon pulse-animation" />
                  Предложения
                </span>
                <span class="progress-values">
                  <b>{{ analysisStore.pageAnalysisSentencesCurrent }}</b> из {{ analysisStore.pageAnalysisSentencesTotal }}
                </span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${analysisStore.pageAnalysisSentencesTotal > 0 ? (analysisStore.pageAnalysisSentencesCurrent / analysisStore.pageAnalysisSentencesTotal) * 100 : 0}%` }" />
              </div>
            </div>

            <!-- Карточка слов -->
            <div
              v-if="analysisStore.pageAnalysisMode === 'words' || analysisStore.pageAnalysisMode === 'all'"
              class="progress-card"
            >
              <div class="progress-header">
                <span class="label-group">
                  <Icon icon="mdi:format-text" class="step-icon pulse-animation" />
                  Слова
                </span>
                <span class="progress-values">
                  <b>{{ analysisStore.pageAnalysisWordsCurrent }}</b> из {{ analysisStore.pageAnalysisWordsTotal }}
                </span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${analysisStore.pageAnalysisWordsTotal > 0 ? (analysisStore.pageAnalysisWordsCurrent / analysisStore.pageAnalysisWordsTotal) * 100 : 0}%` }" />
              </div>
            </div>
          </div>

          <KitBtn color="secondary" variant="outlined" style="width: 100%; margin-top: 4px;" @click="analysisStore.closePageAnalysisModal()">
            Отмена
          </KitBtn>
        </template>

        <!-- Состояние завершения -->
        <template v-else>
          <div class="finished-state">
            <Icon icon="mdi:checkbox-marked-circle-outline" class="success-icon" />
            <div class="success-text">
              <h4>Готово!</h4>
              <p>Все элементы успешно проанализированы и кэшированы для автономной работы.</p>
            </div>
          </div>
          <KitBtn color="primary" style="width: 100%;" @click="analysisStore.closePageAnalysisModal()">
            Отлично
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
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  z-index: var(--z-modal, 1200);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;

  .analysis-dialog {
    background-color: var(--bg-secondary-color);
    padding: 24px;
    border-radius: 16px;
    border: 1px solid var(--border-secondary-color);
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.3);
    text-align: center;
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-sizing: border-box;

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;

      h3 {
        margin: 0;
        color: var(--fg-primary-color);
        font-size: 1.3rem;
        font-weight: 600;
      }

      .title-icon {
        font-size: 1.8rem;
        color: var(--fg-accent-color);
      }
    }

    .analysis-steps {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .progress-card {
      background-color: var(--bg-tertiary-color);
      border: 1px solid var(--border-primary-color);
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      text-align: left;
      box-sizing: border-box;

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
        }
      }
    }

    .finished-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 12px 0;

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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
