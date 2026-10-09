<script setup lang="ts">
import type { DetectiveCase, SrsWord } from '@/shared/types'

interface Props {
  gameCase: DetectiveCase
  words: SrsWord[]
  accusationAttempts: number
  srsError: string
}

defineProps<Props>()

const emit = defineEmits<{
  restart: []
}>()
</script>

<template>
  <main class="result-shell">
    <section class="result-card">
      <div class="result-seal" aria-hidden="true">
        ✓
      </div>
      <p class="eyebrow">
        ДЕЛО РАСКРЫТО
      </p>
      <h1>{{ gameCase.title }}</h1>
      <p class="culprit-line">
        Виновник: <strong>{{ gameCase.suspects.find(suspect => suspect.id === gameCase.culpritId)?.name }}</strong>
      </p>
      <p class="reveal">
        {{ gameCase.reveal }}
      </p>

      <div class="result-stats">
        <div>
          <strong>{{ words.length }}</strong>
          <span>слов прошли все этапы</span>
        </div>
        <div>
          <strong>{{ accusationAttempts }}</strong>
          <span>{{ accusationAttempts === 1 ? 'верная версия' : 'попытки обвинения' }}</span>
        </div>
      </div>
      <p v-if="srsError" class="srs-error" role="status">
        {{ srsError }}
      </p>
      <button type="button" class="restart-button" @click="emit('restart')">
        Вернуться к делам <span aria-hidden="true">→</span>
      </button>
    </section>

    <section class="word-summary">
      <p class="eyebrow">
        СЛОВА ДЕЛА
      </p>
      <div class="word-chips">
        <span v-for="word in words" :key="word.id" class="word-chip">
          <strong>{{ word.word }}</strong>
          <small>{{ word.translation }}</small>
        </span>
      </div>
      <p>Оценка за каждое слово отправлена в SRS после этапа самостоятельной фразы.</p>
    </section>
  </main>
</template>

<style scoped>
.result-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(240px, 0.75fr);
  gap: 18px;
  width: min(980px, 100%);
  margin: auto;
  padding: clamp(24px, 7vh, 72px) clamp(18px, 5vw, 52px);
}
.result-card,
.word-summary {
  padding: clamp(22px, 4vw, 36px);
  border: 1px solid rgba(206, 220, 229, 0.14);
  background: rgba(37, 54, 68, 0.83);
}
.result-card {
  position: relative;
  overflow: hidden;
}
.result-card::after {
  position: absolute;
  top: -80px;
  right: -110px;
  width: 280px;
  height: 280px;
  border: 1px solid rgba(216, 166, 94, 0.12);
  border-radius: 50%;
  box-shadow:
    0 0 0 28px rgba(216, 166, 94, 0.025),
    0 0 0 56px rgba(216, 166, 94, 0.02);
  content: '';
}
.result-seal {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  margin-bottom: 20px;
  border: 1px solid rgba(118, 166, 167, 0.55);
  border-radius: 50%;
  color: #a0c5b9;
  font-size: 22px;
}
.eyebrow {
  margin: 0 0 10px;
  color: #d8a65e;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.17em;
}
h1 {
  margin: 0;
  color: #f3eee5;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(31px, 4vw, 45px);
  font-weight: 400;
  line-height: 1.08;
}
.culprit-line {
  margin: 17px 0 0;
  color: #aebbc4;
  font-size: 13px;
}
.culprit-line strong {
  color: #e2b973;
}
.reveal {
  max-width: 680px;
  margin: 20px 0 0;
  color: #d7ddde;
  font-family: Georgia, serif;
  font-size: 15px;
  line-height: 1.8;
}
.result-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 34px;
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid rgba(206, 220, 229, 0.14);
}
.result-stats div {
  display: grid;
  gap: 4px;
}
.result-stats strong {
  color: #f3eee5;
  font-family: Georgia, serif;
  font-size: 25px;
  font-weight: 400;
}
.result-stats span {
  color: #8fa0ac;
  font-size: 10px;
}
.srs-error {
  color: #e5a18d;
  font-size: 11px;
}
.restart-button {
  display: flex;
  width: 100%;
  min-height: 45px;
  align-items: center;
  justify-content: space-between;
  margin-top: 24px;
  padding: 0 15px;
  border: 0;
  border-radius: 3px;
  background: #d8a65e;
  color: #172431;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}
.word-summary {
  align-self: start;
}
.word-chips {
  display: grid;
  gap: 7px;
  margin-top: 18px;
}
.word-chip {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid rgba(206, 220, 229, 0.11);
  color: #e8e3d9;
  font-size: 11px;
}
.word-chip small {
  color: #91a2af;
  text-align: right;
}
.word-summary > p:last-child {
  margin: 17px 0 0;
  color: #91a2af;
  font-size: 11px;
  line-height: 1.6;
}
@media (max-width: 740px) {
  .result-shell {
    grid-template-columns: 1fr;
  }
}
</style>
