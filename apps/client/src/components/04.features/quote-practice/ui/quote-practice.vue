<script setup lang="ts">
import type { WordToken } from '../model'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog } from '~/components/01.kit'

import { useTts } from '~/shared/composables/use-tts'

interface Props {
  visible: boolean
  quoteText: string
  quoteTranslation: string
  bookLanguage?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'next': []
}>()

const { t } = useI18n()
const tts = useTts()

const allWords = ref<WordToken[]>([])
const selectedWords = ref<WordToken[]>([])
const poolWords = ref<WordToken[]>([])
const isSuccess = ref(false)
const hasError = ref(false)

function shuffle(array: any[]) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function initPractice() {
  if (props.visible && props.quoteText) {
    isSuccess.value = false
    hasError.value = false

    const segmenter = new Intl.Segmenter(props.bookLanguage || undefined, { granularity: 'word' })
    const segments = Array.from(segmenter.segment(props.quoteText))

    const words = segments
      .filter(s => s.isWordLike)
      .map((s, idx) => ({ id: idx, text: s.segment }))

    allWords.value = words
    selectedWords.value = []
    poolWords.value = shuffle(words)
  }
}

watch(() => props.visible, initPractice)
watch(() => props.quoteText, initPractice)

const isCorrect = computed(() => {
  if (selectedWords.value.length !== allWords.value.length)
    return false
  const currentText = selectedWords.value.map(w => w.text).join('').toLowerCase()
  const targetText = allWords.value.map(w => w.text).join('').toLowerCase()
  return currentText === targetText
})

function handleCheck() {
  if (isCorrect.value) {
    isSuccess.value = true
    hasError.value = false
    if (props.bookLanguage) {
      setTimeout(() => {
        tts.speak(props.quoteText, props.bookLanguage)
      }, 500)
    }
  }
  else {
    hasError.value = true
  }
}

function selectWord(word: WordToken) {
  if (isSuccess.value)
    return
  hasError.value = false
  poolWords.value = poolWords.value.filter(w => w.id !== word.id)
  selectedWords.value.push(word)
}

function removeWord(word: WordToken) {
  if (isSuccess.value)
    return
  hasError.value = false
  selectedWords.value = selectedWords.value.filter(w => w.id !== word.id)
  poolWords.value.push(word)
}

function handleReset() {
  selectedWords.value = []
  poolWords.value = shuffle(allWords.value)
  isSuccess.value = false
  hasError.value = false
}
</script>

<template>
  <KitDialog
    :visible="visible"
    :title="t('notebook.selfCheck') || 'Самопроверка'"
    :max-width="600"
    z-index="1450"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="practice-content" :class="{ 'is-success': isSuccess }">
      <div class="translation-box">
        <Icon icon="mdi:translate" class="translation-icon" />
        <p>{{ quoteTranslation }}</p>
      </div>

      <div class="workspace">
        <div class="selected-area" :class="{ 'is-filled': selectedWords.length > 0 }">
          <TransitionGroup name="chip-list" tag="div" class="chip-container">
            <button
              v-for="word in selectedWords"
              :key="word.id"
              class="word-chip is-selected"
              @click="removeWord(word)"
            >
              {{ word.text }}
            </button>
          </TransitionGroup>
          <div v-if="selectedWords.length === 0" class="empty-placeholder">
            {{ t('notebook.tapWordsToBuild') || 'Нажимайте на слова, чтобы собрать фразу' }}
          </div>
        </div>

        <div class="pool-area">
          <TransitionGroup name="chip-list" tag="div" class="chip-container">
            <button
              v-for="word in poolWords"
              :key="word.id"
              class="word-chip is-pool"
              @click="selectWord(word)"
            >
              {{ word.text }}
            </button>
          </TransitionGroup>
        </div>
      </div>

      <div class="banner-container">
        <Transition name="fade">
          <div v-if="isSuccess" class="success-banner">
            <Icon icon="mdi:check-circle-outline" class="success-icon" />
            <span>{{ t('notebook.correct') || 'Правильно! Отличная работа!' }}</span>
          </div>
          <div v-else-if="hasError" class="error-banner">
            <Icon icon="mdi:close-circle-outline" class="error-icon" />
            <div class="banner-text">
              <span class="error-title">{{ t('notebook.wrong') || 'Почти! Попробуйте еще раз.' }}</span>
              <span class="correct-text">{{ quoteText }}</span>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <template #footer>
      <div class="dialog-actions" style="justify-content: space-between;">
        <KitBtn variant="text" :disabled="isSuccess" @click="handleReset">
          {{ t('notebook.reset') || 'Сбросить' }}
        </KitBtn>
        <div style="display: flex; gap: 8px;">
          <!-- Next Button always visible or conditionally? It makes sense to allow skipping or going to next -->
          <KitBtn variant="tonal" @click="emit('next')">
            {{ t('notebook.next') || 'Далее' }}
          </KitBtn>

          <KitBtn
            v-if="!isSuccess"
            color="primary"
            :disabled="selectedWords.length !== allWords.length"
            @click="handleCheck"
          >
            {{ t('notebook.check') || 'Проверить' }}
          </KitBtn>
          <KitBtn
            v-else
            color="success"
            @click="emit('update:visible', false)"
          >
            {{ t('notebook.close') || 'Закрыть' }}
          </KitBtn>
        </div>
      </div>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
.practice-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 8px 0;
  min-height: 300px;
}

.translation-box {
  display: flex;
  gap: 12px;
  background-color: var(--bg-tertiary-color);
  padding: 16px;
  border-radius: 12px;
  border-left: 4px solid var(--fg-accent-color);

  .translation-icon {
    font-size: 1.5rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
    opacity: 0.8;
  }

  p {
    margin: 0;
    font-size: 1.1rem;
    color: var(--fg-primary-color);
    line-height: 1.5;
    font-weight: 500;
  }
}

.workspace {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.selected-area {
  min-height: 120px;
  background: rgba(var(--bg-secondary-color-rgb, 40, 44, 52), 0.3);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  transition: all 0.3s;

  &.is-filled {
    background: rgba(var(--bg-secondary-color-rgb, 40, 44, 52), 0.6);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .empty-placeholder {
    margin: auto;
    text-align: center;
    color: var(--fg-muted-color);
    font-size: 0.95rem;
    opacity: 0.7;
  }
}

.pool-area {
  min-height: 100px;
  padding: 8px 0;
}

.chip-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.selected-area .chip-container {
  justify-content: flex-start;
}

.pool-area .chip-container {
  justify-content: center;
}

.word-chip {
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 1.05rem;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition:
    transform 0.1s,
    box-shadow 0.1s,
    background-color 0.2s;
  border: 1px solid transparent;
}

.word-chip.is-pool {
  background: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
  transform: translateY(0);

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  &:active {
    transform: translateY(4px);
    box-shadow: 0 0 0 rgba(0, 0, 0, 0.2);
  }
}

.word-chip.is-selected {
  background: var(--bg-primary-color);
  color: var(--fg-primary-color);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover {
    background: var(--bg-tertiary-color);
    border-color: rgba(255, 255, 255, 0.2);
  }
}

.success-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  background: rgba(var(--success-color-rgb, 76, 175, 80), 0.15);
  color: var(--success-color, #4caf50);
  border-radius: 12px;
  border: 1px solid rgba(var(--success-color-rgb, 76, 175, 80), 0.3);
  animation: slide-up 0.4s ease-out forwards;

  .success-icon {
    font-size: 1.8rem;
  }

  span {
    font-size: 1.1rem;
    font-weight: 600;
  }
}

.is-success .selected-area {
  border-color: var(--success-color, #4caf50);
  background: rgba(var(--success-color-rgb, 76, 175, 80), 0.05);

  .word-chip {
    background: var(--success-color, #4caf50);
    color: white;
    border-color: transparent;
    pointer-events: none;
    box-shadow: none;
  }
}

.banner-container {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-banner,
.error-banner {
  width: 100%;
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  padding: 12px 16px;
  background: rgba(var(--error-color-rgb, 244, 67, 54), 0.15);
  color: var(--error-color, #f44336);
  border-radius: 12px;
  border: 1px solid rgba(var(--error-color-rgb, 244, 67, 54), 0.3);
  animation: shake 0.4s ease-out forwards;

  .error-icon {
    font-size: 1.8rem;
    flex-shrink: 0;
  }

  .banner-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .error-title {
    font-size: 0.9rem;
    font-weight: 600;
    opacity: 0.9;
  }

  .correct-text {
    font-size: 1.05rem;
    font-weight: 500;
  }
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}

/* List Transitions */
.chip-list-move,
.chip-list-enter-active,
.chip-list-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.chip-list-enter-from,
.chip-list-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(5px);
}

.chip-list-leave-active {
  position: absolute;
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Banner transitions */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s,
    transform 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
