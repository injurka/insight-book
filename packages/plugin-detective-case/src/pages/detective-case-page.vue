<script setup lang="ts">
import type { LearningStage } from '@/shared/types'
import { computed, onMounted } from 'vue'
import { useDetectiveGame } from '@/modules/detective-case/model'
import CaseAccusation from '@/modules/detective-case/ui/case-accusation.vue'
import CaseBoard from '@/modules/detective-case/ui/case-board.vue'
import CaseResult from '@/modules/detective-case/ui/case-result.vue'
import DetectiveHome from '@/modules/detective-case/ui/detective-home.vue'
import LearningStageCard from '@/modules/detective-case/ui/learning-stage-card.vue'

const {
  state,
  currentWord,
  currentChallenge,
  currentStage,
  recognitionOptions,
  completedClues,
  stageNumber,
  progressPercent,
  dueCount,
  loadWords,
  startCase,
  submitRecognition,
  submitMeaning,
  submitContext,
  submitRecall,
  submitProduction,
  advance,
  accuse,
  returnHome,
} = useDetectiveGame()

const stageTitles: Record<LearningStage, string> = {
  recognition: 'Узнать',
  meaning: 'Понять',
  context: 'Контекст',
  recall: 'Вспомнить',
  production: 'Сказать',
}

const gameCase = computed(() => state.gameCase)

function submitCurrentStage(answer: string): void {
  switch (currentStage.value) {
    case 'recognition':
      submitRecognition(answer)
      break
    case 'meaning':
      submitMeaning(answer)
      break
    case 'context':
      submitContext(answer)
      break
    case 'recall':
      submitRecall(answer)
      break
    case 'production':
      void submitProduction(answer)
      break
  }
}
async function restart(): Promise<void> {
  returnHome()
  await loadWords()
}

onMounted(loadWords)
</script>

<template>
  <div class="detective-game">
    <header v-if="state.screen !== 'home' && state.screen !== 'complete'" class="game-header">
      <button class="brand-lockup" type="button" @click="returnHome">
        <span class="brand-mark" aria-hidden="true">D</span>
        <span>
          <strong>DETECTIVE ENGLISH</strong>
          <small>HOTEL MERIDIAN · CASE 01</small>
        </span>
      </button>
      <div class="header-title">
        <span>ТЕКУЩЕЕ ДЕЛО</span>
        <strong>{{ gameCase?.title }}</strong>
      </div>
      <button class="exit-button" type="button" @click="returnHome">
        Выйти из дела
      </button>
    </header>

    <DetectiveHome
      v-if="state.screen === 'home'"
      :words="state.words"
      :due-count="dueCount"
      :is-loading="state.request.isLoadingWords"
      :is-generating="state.request.isGeneratingCase"
      :error="state.request.error"
      @start="startCase"
      @reload="loadWords"
    />

    <section v-else-if="state.screen === 'playing' && gameCase && currentWord && currentChallenge" class="play-shell">
      <div class="case-progress">
        <div class="progress-caption">
          <span>СЛОВО {{ state.current.wordIndex + 1 }} ИЗ {{ state.words.length }}</span>
          <span>ЭТАП {{ stageNumber }} ИЗ 5</span>
        </div>
        <div class="progress-track">
          <span :style="{ width: `${progressPercent}%` }" />
        </div>
        <ol class="stage-track" aria-label="Этапы освоения слова">
          <li
            v-for="(stage, index) in Object.keys(stageTitles) as LearningStage[]"
            :key="stage"
            :class="{ active: index === state.current.stageIndex, complete: index < state.current.stageIndex }"
          >
            <span>{{ index < state.current.stageIndex ? '✓' : `0${index + 1}` }}</span>
            {{ stageTitles[stage] }}
          </li>
        </ol>
      </div>

      <div class="play-grid">
        <CaseBoard :game-case="gameCase" :clues="completedClues" />
        <div class="active-exercise">
          <div class="active-title">
            <div>
              <p class="section-eyebrow">
                РАБОТА С ПОКАЗАНИЕМ
              </p>
              <h1>{{ gameCase.title }}</h1>
            </div>
            <span class="word-position">{{ state.current.wordIndex + 1 }} / {{ state.words.length }}</span>
          </div>
          <LearningStageCard
            :word="currentWord"
            :challenge="currentChallenge"
            :stage="currentStage"
            :recognition-options="recognitionOptions"
            :feedback="state.response.feedback"
            :is-checking="state.request.isCheckingProduction"
            :is-saving="state.request.isSavingGrade"
            @submit="submitCurrentStage"
            @continue="advance"
          />
          <p v-if="state.request.srsError" class="srs-warning" role="status">
            {{ state.request.srsError }}
          </p>
        </div>
      </div>
    </section>

    <section v-else-if="state.screen === 'accusation' && gameCase" class="final-grid">
      <CaseBoard :game-case="gameCase" :clues="completedClues" />
      <CaseAccusation
        :game-case="gameCase"
        :feedback="state.response.accusationFeedback"
        :selected-suspect-id="state.accusedSuspectId"
        @accuse="accuse"
      />
    </section>

    <CaseResult
      v-else-if="state.screen === 'complete' && gameCase"
      :game-case="gameCase"
      :words="state.words"
      :accusation-attempts="state.progress.accusationAttempts"
      :srs-error="state.request.srsError"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.detective-game {
  min-height: 100dvh;
  color: #e9e4da;
  background:
    radial-gradient(ellipse at 16% 7%, rgba(69, 95, 111, 0.22), transparent 35%),
    radial-gradient(ellipse at 87% 89%, rgba(179, 124, 67, 0.08), transparent 30%), #111e2b;
  font-family: var(--app-font-family, Inter, 'Segoe UI', sans-serif);
}
.game-header {
  display: grid;
  grid-template-columns: 1fr minmax(170px, 0.7fr) 1fr;
  align-items: center;
  gap: 20px;
  min-height: 72px;
  padding: 12px clamp(18px, 4vw, 48px);
  border-bottom: 1px solid rgba(206, 220, 229, 0.12);
  background: rgba(14, 26, 37, 0.6);
}
.brand-lockup {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  justify-self: start;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.brand-mark {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid rgba(216, 166, 94, 0.5);
  color: #e2b973;
  font-family: Georgia, serif;
  font-size: 18px;
}
.brand-lockup strong,
.brand-lockup small {
  display: block;
}
.brand-lockup strong {
  color: #e9e4da;
  font-size: 9px;
  letter-spacing: 0.16em;
}
.brand-lockup small {
  margin-top: 5px;
  color: #81939f;
  font-size: 8px;
  letter-spacing: 0.11em;
}
.header-title {
  display: grid;
  gap: 5px;
  text-align: center;
}
.header-title span {
  color: #81939f;
  font-size: 8px;
  letter-spacing: 0.16em;
}
.header-title strong {
  overflow: hidden;
  color: #d8d5ce;
  font-family: Georgia, serif;
  font-size: 13px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.exit-button {
  justify-self: end;
  padding: 9px 12px;
  border: 1px solid rgba(206, 220, 229, 0.15);
  border-radius: 3px;
  background: transparent;
  color: #9dadb7;
  cursor: pointer;
  font-size: 10px;
}
.exit-button:hover {
  border-color: rgba(216, 166, 94, 0.5);
  color: #e2b973;
}
.play-shell {
  width: min(1440px, 100%);
  margin: auto;
  padding: 26px clamp(16px, 3.5vw, 46px) 44px;
}
.case-progress {
  max-width: 980px;
  margin: 0 auto 25px;
}
.progress-caption {
  display: flex;
  justify-content: space-between;
  color: #96a6b0;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
}
.progress-track {
  height: 3px;
  margin-top: 11px;
  overflow: hidden;
  background: rgba(206, 220, 229, 0.12);
}
.progress-track span {
  display: block;
  height: 100%;
  background: #d8a65e;
  transition: width 0.25s ease;
}
.stage-track {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 13px 0 0;
  padding: 0;
  list-style: none;
}
.stage-track li {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #718491;
  font-size: 9px;
  letter-spacing: 0.04em;
}
.stage-track li span {
  display: grid;
  width: 19px;
  height: 19px;
  place-items: center;
  border: 1px solid rgba(206, 220, 229, 0.16);
  border-radius: 50%;
  font-size: 8px;
}
.stage-track li.active {
  color: #e5c690;
}
.stage-track li.active span,
.stage-track li.complete span {
  border-color: #d8a65e;
  background: rgba(216, 166, 94, 0.13);
  color: #e2b973;
}
.play-grid {
  display: grid;
  grid-template-columns: minmax(245px, 0.78fr) minmax(0, 1.55fr);
  gap: clamp(17px, 2.5vw, 34px);
  align-items: start;
}
.active-exercise {
  min-width: 0;
}
.active-title {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  margin: 2px 0 15px;
}
.section-eyebrow {
  margin: 0 0 6px;
  color: #d8a65e;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.17em;
}
.active-title h1 {
  margin: 0;
  color: #e9e4da;
  font-family: Georgia, serif;
  font-size: 23px;
  font-weight: 400;
}
.word-position {
  color: #899aa5;
  font-family: Georgia, serif;
  font-size: 18px;
}
.srs-warning {
  color: #e5a18d;
  font-size: 11px;
  line-height: 1.5;
}
.final-grid {
  display: grid;
  grid-template-columns: minmax(245px, 0.78fr) minmax(0, 1.55fr);
  gap: clamp(17px, 2.5vw, 34px);
  width: min(1200px, 100%);
  align-items: start;
  margin: auto;
  padding: 26px clamp(16px, 3.5vw, 46px) 44px;
}
@media (max-width: 850px) {
  .play-grid,
  .final-grid {
    grid-template-columns: 1fr;
  }
  .case-board {
    order: 2;
  }
}
@media (max-width: 620px) {
  .game-header {
    grid-template-columns: 1fr auto;
    gap: 10px;
    min-height: 62px;
  }
  .header-title {
    display: none;
  }
  .exit-button {
    font-size: 9px;
  }
  .stage-track li {
    flex-direction: column;
    gap: 4px;
    font-size: 8px;
  }
  .active-title h1 {
    font-size: 19px;
  }
}
</style>
