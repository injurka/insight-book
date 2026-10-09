<script setup lang="ts">
import type { CaseClue, DetectiveCase } from '@/shared/types'

interface Props {
  gameCase: DetectiveCase
  clues: CaseClue[]
}

defineProps<Props>()
</script>

<template>
  <aside class="case-board">
    <section class="board-section">
      <div class="section-heading">
        <span class="section-index">01</span>
        <h2>Материалы дела</h2>
      </div>
      <p class="case-opening">
        {{ gameCase.opening }}
      </p>
    </section>

    <section class="board-section">
      <div class="section-heading">
        <span class="section-index">02</span>
        <h2>Подозреваемые</h2>
      </div>
      <article v-for="suspect in gameCase.suspects" :key="suspect.id" class="suspect-card">
        <div class="suspect-heading">
          <strong>{{ suspect.name }}</strong>
          <span>{{ suspect.role }}</span>
        </div>
        <p>“{{ suspect.statement }}”</p>
      </article>
    </section>

    <section class="board-section">
      <div class="section-heading">
        <span class="section-index">03</span>
        <h2>Улики <span class="clue-count">{{ clues.length }}</span></h2>
      </div>
      <article v-for="(clue, index) in clues" :key="clue.wordId" class="clue-card">
        <span class="clue-number">0{{ index + 1 }}</span>
        <div>
          <strong>{{ clue.title }}</strong>
          <p>{{ clue.description }}</p>
        </div>
      </article>
      <p v-if="clues.length === 0" class="no-clues">
        Завершите первое упражнение, чтобы получить улику.
      </p>
    </section>
  </aside>
</template>

<style scoped>
.case-board {
  display: grid;
  align-content: start;
  gap: 24px;
  padding: 20px;
  border: 1px solid rgba(206, 220, 229, 0.14);
  background: rgba(27, 43, 57, 0.7);
}
.board-section + .board-section {
  padding-top: 20px;
  border-top: 1px solid rgba(206, 220, 229, 0.11);
}
.section-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}
.section-index,
.clue-number {
  color: #d8a65e;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.13em;
}
h2 {
  margin: 0;
  color: #e7e3d9;
  font-family: Georgia, serif;
  font-size: 17px;
  font-weight: 400;
}
.clue-count {
  display: inline-grid;
  width: 18px;
  height: 18px;
  place-items: center;
  margin-left: 4px;
  border-radius: 50%;
  background: rgba(216, 166, 94, 0.18);
  color: #e2b973;
  font-family: Arial, sans-serif;
  font-size: 10px;
}
.case-opening {
  margin: 14px 0 0;
  color: #aebbc4;
  font-size: 12px;
  line-height: 1.7;
}
.suspect-card {
  margin-top: 12px;
  padding: 12px;
  border-left: 2px solid rgba(216, 166, 94, 0.52);
  background: rgba(255, 255, 255, 0.035);
}
.suspect-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 5px 12px;
}
.suspect-heading strong,
.clue-card strong {
  color: #e7e3d9;
  font-size: 12px;
  font-weight: 650;
}
.suspect-heading span {
  color: #91a2af;
  font-size: 10px;
}
.suspect-card p {
  margin: 8px 0 0;
  color: #c7cfd3;
  font-family: Georgia, serif;
  font-size: 12px;
  font-style: italic;
  line-height: 1.55;
}
.clue-card {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  background: rgba(216, 166, 94, 0.08);
}
.clue-card p {
  margin: 5px 0 0;
  color: #aebbc4;
  font-size: 11px;
  line-height: 1.6;
}
.no-clues {
  margin: 14px 0 0;
  color: #8294a1;
  font-size: 11px;
  line-height: 1.6;
}
</style>
