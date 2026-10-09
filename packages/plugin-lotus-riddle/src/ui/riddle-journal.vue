<script setup lang="ts">
import type { Round } from '../shared/types'
import { nextTick, ref, watch } from 'vue'
import { DIRECTIONS, MAX_TURNS, VERDICTS } from '../shared/types'

interface Props { round: Round, busy: boolean }

const props = defineProps<Props>()
const journal = ref<HTMLElement | null>(null)
watch(() => [props.round.turns.length, props.busy], async () => {
  await nextTick()

  if (journal.value)
    journal.value.scrollTop = journal.value.scrollHeight
})
</script>

<template>
  <section class="lr-paper lr-journal">
    <header class="lr-journal-heading">
      <h2>Журнал вопросов</h2><span>{{ round.turns.length }} / {{ MAX_TURNS }} ходов</span>
    </header>
    <div
      ref="journal"
      class="lr-journal-scroll"
      role="log"
      aria-label="Вопросы и ответы хранителя"
      aria-live="polite"
      tabindex="0"
    >
      <div class="lr-opening">
        <span class="lr-seal" aria-hidden="true">❋</span><div><strong>Хранитель лотоса</strong><p>{{ round.mystery.introduction }}</p></div>
      </div>
      <div v-if="!round.turns.length" class="lr-journal-empty">
        <span aria-hidden="true">◇</span><p>Начните с самого простого.<br>Это живое? Это можно держать в руках?</p>
      </div>
      <article v-for="(turn, index) in round.turns" :key="index" class="lr-turn">
        <div class="lr-turn-top">
          <span>{{ String(index + 1).padStart(2, '0') }} · {{ turn.kind === 'guess' ? 'Догадка' : 'Вопрос' }}</span>
        </div>
        <p class="lr-question">
          {{ turn.text }}
        </p>
        <div class="lr-reply">
          <span class="lr-verdict" :class="`lr-${turn.verdict}`">{{ VERDICTS[turn.verdict] }}</span><span>{{ DIRECTIONS[turn.direction] }}</span>
        </div>
        <p v-if="turn.verdict === 'unclear'" class="lr-answer-note">
          Задайте один вопрос о признаке слова, на который можно ответить «да» или «нет».
        </p>
        <p v-if="turn.verdict === 'almost'" class="lr-answer-note">
          Вы нашли смысл. Теперь вспомните само слово на изучаемом языке.
        </p>
      </article>
      <div v-if="busy" class="lr-thinking" role="status">
        Хранитель размышляет<span aria-hidden="true">…</span>
      </div>
    </div>
  </section>
</template>
