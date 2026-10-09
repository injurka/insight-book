<script setup lang="ts">
interface Props { language: string, prepared: boolean, count: number, disabled: boolean }

defineProps<Props>()
const emit = defineEmits<{ language: [value: string], prepare: [], begin: [] }>()
</script>

<template>
  <section class="lr-home lr-wood">
    <span class="lr-eyebrow">Игра со словами · SRS</span>
    <h1>Каждое слово —<br>маленькая тайна.</h1>
    <p class="lr-lead">
      За чашкой чая хранитель загадает слово из ваших повторений. Найдите его, задавая вопросы, на которые можно ответить «да» или «нет».
    </p>
    <ol class="lr-rules">
      <li><span>01</span> Спрашивайте по одному признаку.</li>
      <li><span>02</span> Следуйте ответам и берите подсказки.</li>
      <li><span>03</span> Назовите слово на изучаемом языке.</li>
    </ol>
    <label class="lr-field-label" for="lr-language">Язык ваших карточек</label>
    <div class="lr-language-row">
      <select
        id="lr-language"
        :value="language"
        :disabled="disabled"
        @change="emit('language', ($event.target as HTMLSelectElement).value)"
      >
        <option value="en">
          Английский
        </option><option value="zh">
          Китайский
        </option><option value="ja">
          Японский
        </option><option value="ru">
          Русский
        </option>
      </select>
      <span class="lr-soft">Вопросы — на любом языке</span>
    </div>
    <div v-if="prepared" class="lr-queue" role="status">
      <template v-if="count">
        Подходящих существительных: <strong>{{ count }}</strong>. Сначала — самые просроченные.
      </template>
      <template v-else>
        В этой очереди нет подходящих существительных. Возможно, повторения закончились или часть речи неоднозначна. Попробуйте другой язык либо вернитесь позже.
      </template>
    </div>
    <button
      v-if="prepared && count"
      class="lr-button lr-primary lr-wide"
      :disabled="disabled"
      @click="emit('begin')"
    >
      Войти в павильон <span aria-hidden="true">→</span>
    </button>
    <button
      v-else
      class="lr-button lr-primary lr-wide"
      :disabled="disabled"
      @click="emit('prepare')"
    >
      {{ prepared ? 'Проверить очередь снова' : 'Найти слова для игры' }} <span aria-hidden="true">→</span>
    </button>
    <p class="lr-footnote">
      20 ходов · 3 подсказки · без таймера<br>Оценку повторения выбираете вы после раунда.
    </p>
  </section>
</template>
