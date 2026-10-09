<script setup lang="ts">
import { ref } from 'vue'

interface Props { disabled: boolean, submit: (text: string, kind: 'question' | 'guess') => Promise<boolean> }

const props = defineProps<Props>()
const text = ref('')
const kind = ref<'question' | 'guess'>('question')
const composing = ref(false)
async function send() {
  if (props.disabled || composing.value)
    return

  if (await props.submit(text.value, kind.value))
    text.value = ''
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !composing.value) {
    event.preventDefault()
    void send()
  }
}
</script>

<template>
  <form class="lr-composer lr-wood" @submit.prevent="send">
    <div class="lr-composer-heading">
      <div class="lr-tabs" role="group" aria-label="Тип хода">
        <button
          type="button"
          :aria-pressed="kind === 'question'"
          :disabled="disabled"
          @click="kind = 'question'"
        >
          Вопрос
        </button><button
          type="button"
          :aria-pressed="kind === 'guess'"
          :disabled="disabled"
          @click="kind = 'guess'"
        >
          Назвать слово
        </button>
      </div>
      <span class="lr-soft">{{ text.length }} / 300</span>
    </div>
    <label for="lr-move" class="lr-sr-only">{{ kind === 'question' ? 'Ваш вопрос хранителю' : 'Догадка на изучаемом языке' }}</label>
    <textarea
      id="lr-move"
      v-model="text"
      maxlength="300"
      rows="2"
      :disabled="disabled"
      :placeholder="kind === 'question' ? 'Это можно найти в доме?' : 'Напишите загаданное слово…'"
      @keydown="keydown"
      @compositionstart="composing = true"
      @compositionend="composing = false"
    />
    <div class="lr-composer-bottom">
      <small>{{ kind === 'question' ? 'Enter — спросить · Shift + Enter — новая строка' : 'Нужно слово на языке карточки, а не перевод.' }}</small><button class="lr-button lr-primary" :disabled="disabled || composing || !text.trim()" type="submit">
        {{ kind === 'question' ? 'Спросить' : 'Проверить' }} <span aria-hidden="true">→</span>
      </button>
    </div>
  </form>
</template>
