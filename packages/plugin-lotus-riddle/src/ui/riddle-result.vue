<script setup lang="ts">
import type { Round } from '../shared/types'
import { onMounted, ref } from 'vue'

interface Props { round: Round, disabled: boolean }

defineProps<Props>()
const emit = defineEmits<{ grade: [value: number], skip: [], next: [] }>()

const heading = ref<HTMLElement | null>(null)
const grades = [{ value: 1, title: 'Не вспомнил', description: 'Нужно повторить' }, { value: 2, title: 'Трудно', description: 'Вспомнил с усилием' }, { value: 3, title: 'Хорошо', description: 'Помнил слово' }, { value: 4, title: 'Легко', description: 'Сразу узнал' }]
onMounted(() => {
  heading.value?.scrollIntoView({ block: 'start' })
  heading.value?.focus({ preventScroll: true })
})
</script>

<template>
  <section class="lr-paper lr-result" aria-labelledby="lr-result-title">
    <span class="lr-eyebrow">{{ round.outcome === 'solved' ? 'Тайна раскрыта' : 'Новое знакомство со словом' }}</span>
    <h2 id="lr-result-title" ref="heading" tabindex="-1">
      {{ round.outcome === 'solved' ? 'Верный путь привёл вас сюда.' : round.outcome === 'exhausted' ? 'Двадцать шагов позади.' : 'Иногда полезно открыть свиток.' }}
    </h2>
    <p class="lr-target" :lang="round.word.language">
      {{ round.word.word }}
    </p><p v-if="round.word.transcription" class="lr-transcription">
      {{ round.word.transcription }}
    </p><p class="lr-translation">
      {{ round.word.translation }}
    </p>
    <p class="lr-result-count">
      Ходов: {{ round.turns.length }} · Подсказок: {{ round.hintsUsed }} / 3
    </p>
    <template v-if="round.grade === 'idle'">
      <h3>Как хорошо вы помнили слово?</h3><p>Оцените знание слова, а не сложность загадки. Вопросы ещё не изменили расписание SRS.</p>
      <div class="lr-grades">
        <button
          v-for="grade in grades"
          :key="grade.value"
          class="lr-grade"
          :disabled="disabled"
          @click="emit('grade', grade.value)"
        >
          <strong>{{ grade.title }}</strong><small>{{ grade.description }}</small>
        </button>
      </div>
      <button class="lr-text-button" :disabled="disabled" @click="emit('skip')">
        Продолжить без записи в SRS
      </button>
    </template>
    <p v-else-if="round.grade === 'sending'" role="status">
      Сохраняем оценку в SRS…
    </p>
    <template v-else>
      <p v-if="round.grade === 'saved'" class="lr-saved" role="status">
        ✓ Повторение сохранено в SRS.
      </p>
      <p v-else-if="round.grade === 'uncertain'" role="status">
        Запись не подтверждена. Проверьте карточку в словаре: сервер мог принять оценку. Повторная отправка отключена.
      </p>
      <p v-else>
        Раунд завершён без изменения SRS.
      </p>
      <button class="lr-button lr-primary" :disabled="disabled" @click="emit('next')">
        Следующая тайна <span aria-hidden="true">→</span>
      </button>
    </template>
  </section>
</template>
