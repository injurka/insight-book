<script setup lang="ts">
import type { DetectiveCase } from '@/shared/types'

interface Props {
  gameCase: DetectiveCase
  feedback: string
  selectedSuspectId: string
}

defineProps<Props>()

const emit = defineEmits<{
  accuse: [suspectId: string]
}>()
</script>

<template>
  <section class="accusation-shell">
    <p class="eyebrow">
      ФИНАЛЬНЫЙ ОТЧЁТ
    </p>
    <h1>Кто забрал картину?</h1>
    <p class="intro">
      Сопоставьте показания с уликами и назовите подозреваемого.
    </p>

    <div class="suspect-options">
      <button
        v-for="suspect in gameCase.suspects"
        :key="suspect.id"
        type="button"
        class="suspect-option"
        :class="{ selected: selectedSuspectId === suspect.id }"
        @click="emit('accuse', suspect.id)"
      >
        <span class="suspect-number">{{ suspect.id.slice(0, 2).toUpperCase() }}</span>
        <span class="suspect-info">
          <strong>{{ suspect.name }}</strong>
          <small>{{ suspect.role }}</small>
          <em>“{{ suspect.statement }}”</em>
        </span>
        <span class="arrow" aria-hidden="true">→</span>
      </button>
    </div>

    <p v-if="feedback" class="case-feedback" role="status">
      {{ feedback }}
    </p>
  </section>
</template>

<style scoped>
.accusation-shell {
  width: min(760px, 100%);
  margin: 0 auto;
  padding: clamp(24px, 6vh, 60px) clamp(18px, 4vw, 44px);
}
.eyebrow {
  margin: 0 0 13px;
  color: #d8a65e;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
}
h1 {
  margin: 0;
  color: #f3eee5;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(36px, 6vw, 60px);
  font-weight: 400;
  letter-spacing: -0.035em;
}
.intro {
  margin: 13px 0 26px;
  color: #aebbc4;
  font-size: 14px;
  line-height: 1.7;
}
.suspect-options {
  display: grid;
  gap: 10px;
}
.suspect-option {
  display: grid;
  grid-template-columns: 34px 1fr 24px;
  gap: 14px;
  align-items: center;
  width: 100%;
  padding: 15px;
  border: 1px solid rgba(206, 220, 229, 0.15);
  background: rgba(37, 54, 68, 0.75);
  color: #e7e3d9;
  cursor: pointer;
  text-align: left;
  transition:
    border 0.15s ease,
    background 0.15s ease;
}
.suspect-option:hover {
  border-color: rgba(216, 166, 94, 0.65);
  background: rgba(216, 166, 94, 0.08);
}
.suspect-option.selected {
  border-color: #d8a65e;
}
.suspect-number {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid rgba(216, 166, 94, 0.35);
  color: #d8a65e;
  font-family: Georgia, serif;
  font-size: 12px;
}
.suspect-info {
  display: grid;
  gap: 4px;
}
.suspect-info strong {
  font-size: 14px;
}
.suspect-info small {
  color: #92a3af;
  font-size: 10px;
}
.suspect-info em {
  margin-top: 4px;
  color: #c4cdd1;
  font-family: Georgia, serif;
  font-size: 12px;
  line-height: 1.5;
}
.arrow {
  color: #d8a65e;
  font-size: 18px;
}
.case-feedback {
  margin: 17px 0 0;
  color: #e6b49f;
  font-size: 13px;
}
</style>
