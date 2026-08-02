<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/index.ts'
import OnboardingStepLayout from './onboarding-step-layout.vue'

const emit = defineEmits<{
  next: []
}>()
const { t } = useI18n()

// 0 - ждем клика по облачку, 1 - облачко нажато (sentence popover), 2 - нажато слово (word popover)
const currentStep = ref(0)
const activeWordId = ref<string | null>(null)
const wordClicked = ref(false)
const showBubbleHint = ref(false)
const showWordHint = ref(false)
const randomWordIdForHint = ref('nàme')

let bubbleTimer: ReturnType<typeof setTimeout> | null = null
let wordTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  bubbleTimer = setTimeout(() => {
    if (currentStep.value === 0)
      showBubbleHint.value = true
  }, 3000)
})

onUnmounted(() => {
  if (bubbleTimer)
    clearTimeout(bubbleTimer)
  if (wordTimer)
    clearTimeout(wordTimer)
})

// Словарик из вашего примера HTML
const mockDict: Record<string, any> = {
  'nàme': {
    tr: 'nàme',
    trans: 'тогда, в таком случае, значит',
    pos: 'Местоимение',
    posClass: 'pos-pronoun',
    rules: [{ pattern: '那么 (nàme) в начале предложения', exp: 'Используется как союз для логического перехода, связывающий предыдущее высказывание с выводом или следующим действием.' }],
    vocabs: [{ word: '那么', tr: '(nàme)', mean: 'тогда, в таком случае; до такой степени' }],
  },
  'yǒu': {
    tr: 'yǒu',
    trans: 'иметь, обладать, существовать',
    pos: 'Глагол',
    posClass: 'pos-verb',
    rules: [{ pattern: '有 (yǒu) как глагол обладания', exp: 'Используется для выражения наличия чего-либо у субъекта. В отрицании всегда используется \'méiyǒu\' (没有), а не \'bù yǒu\'.' }, { pattern: '有 (yǒu) в значении экзистенции', exp: 'Используется для указания на наличие объекта в определенном месте (аналог \'есть/имеется\').' }],
    vocabs: [{ word: '有', tr: '(yǒu)', mean: 'иметь, обладать, существовать' }],
  },
  'shénme': {
    tr: 'shénme',
    trans: 'Что? Какой? Какой-либо.',
    pos: 'Местоимение',
    posClass: 'pos-pronoun',
    rules: [{ pattern: '什么 (shénme) в вопросительных предложениях', exp: 'Используется как вопросительное местоимение для выяснения предмета или действия. В китайском языке не требует перемещения в начало предложения.' }, { pattern: '什么 (shénme) как определитель', exp: 'Ставится перед существительным для уточнения его вида или качества.' }],
    vocabs: [{ word: '什么', tr: '(shénme)', mean: 'что, какой' }],
  },
  'shì me': {
    tr: 'shì me',
    trans: 'Что случилось? / В чем дело?',
    pos: 'Неизвестно',
    posClass: 'pos-default',
    rules: [{ pattern: '事 (shì) + 么 (me)', exp: 'Это разговорная, сокращенная форма вопроса \'什么事?\' (shénme shì?), где \'么\' выступает как редуцированный суффикс, превращающий существительное в вопросительную конструкцию.' }],
    vocabs: [{ word: '事', tr: '(shì)', mean: 'дело, событие, работа' }, { word: '么', tr: '(me)', mean: 'суффикс, вопросительная частица' }],
  },
  'dàshù': {
    tr: 'dàshù',
    trans: 'Большое дерево',
    pos: 'Существительное',
    posClass: 'pos-noun',
    rules: [{ pattern: 'Прилагательное + Существительное', exp: 'В китайском языке определение (прилагательное) ставится перед определяемым словом (существительным) без дополнительных связок.' }],
    vocabs: [{ word: '大', tr: '(dà)', mean: 'большой, крупный' }, { word: '树', tr: '(shù)', mean: 'дерево' }],
  },
  'tóngxué': {
    tr: 'tóngxué',
    trans: 'одноклассник, сокурсник',
    pos: 'Существительное',
    posClass: 'pos-noun',
    rules: [{ pattern: 'Словосложение (иероглифическая комбинация)', exp: 'Слово образовано путем сложения двух корней, где первый указывает на общность, а второй — на действие.' }],
    vocabs: [{ word: '同', tr: '(tóng)', mean: 'одинаковый, общий, вместе' }, { word: '学', tr: '(xué)', mean: 'учиться, учеба' }],
  },
}

const activeDict = computed(() => activeWordId.value ? mockDict[activeWordId.value] : null)

function handleBubbleClick() {
  if (currentStep.value === 0) {
    currentStep.value = 1
    showBubbleHint.value = false
    if (bubbleTimer)
      clearTimeout(bubbleTimer)

    wordTimer = setTimeout(() => {
      if (!wordClicked.value) {
        showWordHint.value = true
        const words = ['nàme', 'yǒu', 'shénme', 'shì me', 'dàshù', 'tóngxué']
        randomWordIdForHint.value = words[Math.floor(Math.random() * words.length)]
      }
    }, 3000)
  }
}

function handleWordClick(id: string, isPunct: boolean) {
  if (isPunct)
    return
  activeWordId.value = id
  currentStep.value = 2
  wordClicked.value = true
  showWordHint.value = false
  if (wordTimer)
    clearTimeout(wordTimer)
}

function closeWordPopover() {
  currentStep.value = 1
  activeWordId.value = null
}
</script>

<template>
  <OnboardingStepLayout
    :title="t('onboarding.step3_title')"
    :description="t('onboarding.step3_desc')"
    icon="mdi:image-search-outline"
    icon-class="accent-icon"
  >
    <div class="interactive-zone">
      <div class="manga-container">
        <!-- Картинка манги из папки assets -->
        <img src="../../../../assets/images/manga-preview.png" class="manga-image" alt="Manga Page">

        <!-- Интерактивный блок OCR (Координаты настроены под облачко справа вверху) -->
        <div
          class="ocr-bubble"
          :class="{ 'is-active': currentStep >= 1, 'blink': showBubbleHint && currentStep === 0 }"
          @click="handleBubbleClick"
        />

        <!-- Всплывающее окно с разбором (Sentence Popover) -->
        <Transition name="fade-zoom">
          <div v-if="currentStep >= 1" class="bubble-popover js-tooltip-selectable">
            <div class="bubble-popover-text">
              <span class="sentence">
                <span class="word" :class="{ 'is-active': activeWordId === 'nàme', 'blink': showWordHint && randomWordIdForHint === 'nàme' }" @click.stop="handleWordClick('nàme', false)">那么</span>
                <span class="word" :class="{ 'is-active': activeWordId === 'yǒu', 'blink': showWordHint && randomWordIdForHint === 'yǒu' }" @click.stop="handleWordClick('yǒu', false)">有</span>
                <span class="word" :class="{ 'is-active': activeWordId === 'shénme', 'blink': showWordHint && randomWordIdForHint === 'shénme' }" @click.stop="handleWordClick('shénme', false)">什么</span>
                <span class="word" :class="{ 'is-active': activeWordId === 'shì me', 'blink': showWordHint && randomWordIdForHint === 'shì me' }" @click.stop="handleWordClick('shì me', false)">事么</span>
                <span class="word is-punctuation" @click.stop>？</span>
              </span>
              <span class="sentence">
                <span class="word" :class="{ 'is-active': activeWordId === 'dàshù', 'blink': showWordHint && randomWordIdForHint === 'dàshù' }" @click.stop="handleWordClick('dàshù', false)">大树</span>
                <span class="word" :class="{ 'is-active': activeWordId === 'tóngxué', 'blink': showWordHint && randomWordIdForHint === 'tóngxué' }" @click.stop="handleWordClick('tóngxué', false)">同学</span>
              </span>
            </div>
          </div>
        </Transition>

        <!-- Всплывающее окно детального разбора слова (Word Popover) -->
        <Transition name="fade-zoom">
          <div v-if="currentStep === 2 && activeDict" class="word-popover">
            <div class="transcription-header">
              <span class="header-text">{{ activeDict.tr }}</span>
              <button class="close-btn" @click.stop="closeWordPopover">
                <Icon width="18" height="18" icon="mdi:close" />
              </button>
            </div>

            <div class="popover-content">
              <div class="height-animator">
                <div class="popover-inner-grid">
                  <div class="popover-body">
                    <div class="translation">
                      {{ activeDict.trans }}
                    </div>

                    <div v-if="activeDict.rules" class="ai-section">
                      <div class="ai-subtitle">
                        Грамматика:
                      </div>
                      <div v-for="(rule, idx) in activeDict.rules" :key="`r${idx}`" class="ai-rule">
                        <b>{{ rule.pattern }}</b> — {{ rule.exp }}
                      </div>
                    </div>

                    <div v-if="activeDict.vocabs" class="ai-section">
                      <div class="ai-subtitle">
                        Лексика:
                      </div>
                      <div v-for="(vocab, idx) in activeDict.vocabs" :key="`v${idx}`" class="ai-vocab">
                        <b>{{ vocab.word }}</b> {{ vocab.tr }} — {{ vocab.mean }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="popover-footer">
              <div class="pos-badge" :class="activeDict.posClass">
                {{ activeDict.pos }}
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Фиксированная зона действий -->
    <div class="step-actions" style="flex-direction: column; gap: 8px;">
      <div v-if="currentStep >= 1 && !wordClicked" class="success-text" style="color: var(--fg-accent-color); font-weight: 500; font-size: 1.1rem; text-align: center;">
        {{ t('onboarding.step3_success') }}
      </div>

      <KitBtn
        v-if="wordClicked"
        color="primary"
        class="next-btn"
        @click="emit('next')"
      >
        Далее <Icon icon="mdi:arrow-right" class="ml-2" />
      </KitBtn>
      <div v-else-if="currentStep === 0" class="hint-action blink" @click="handleBubbleClick">
        <Icon icon="mdi:cursor-pointer" />
        <span>{{ t('onboarding.step3_action') }}</span>
      </div>
      <div v-else-if="currentStep === 1 && !wordClicked" class="hint-action blink" @click="handleWordClick('nàme', false)">
        <Icon icon="mdi:cursor-pointer" />
        <span>Кликни на слово</span>
      </div>
    </div>
  </OnboardingStepLayout>
</template>

<style lang="scss" scoped>
:deep(.accent-icon) {
  color: var(--fg-accent-color) !important;
}

.interactive-zone {
  width: 100%;
  padding: 16px;
  margin-bottom: 16px;
  height: 380px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.step-actions {
  height: 60px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.manga-container {
  position: relative;
  display: inline-block;
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  background-color: var(--bg-secondary-color);
}

.manga-image {
  max-height: 340px;
  max-width: 100%;
  display: block;
  border-radius: 8px;
  object-fit: contain;
  pointer-events: none;
}

.ocr-bubble {
  position: absolute;
  top: 2%;
  left: 68%;
  width: 30%;
  height: 42%;
  border-radius: 12px;
  cursor: pointer;
  background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.1);
  border: 2px solid transparent;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.3);
    backdrop-filter: blur(2px) brightness(1.1);
  }

  &.is-active {
    border-color: var(--fg-accent-color);
    background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.2);
  }
}

.bubble-popover {
  position: absolute;
  top: 60%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(var(--bg-tertiary-color-rgb, 33, 38, 45), 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  padding: 12px 8px;
  z-index: 10;
  color: var(--fg-primary-color);
  text-align: left;
  font-size: 1.06rem;
  width: max-content;
  max-width: 90%;

  .sentence {
    display: inline;
  }
  .word {
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    transition: background-color 0.2s;

    &:not(.is-punctuation):hover {
      background-color: var(--bg-hover-color);
    }
    &.is-active {
      background-color: var(--fg-accent-color);
      color: var(--bg-primary-color);
      font-weight: bold;
    }
    &.is-punctuation {
      cursor: default;
    }
  }
}

.word-popover {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  width: 95%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 20;

  .transcription-header {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    position: relative;

    .header-text {
      font-weight: 600;
      color: var(--fg-accent-color);
      font-size: 1.15rem;
    }
    .close-btn {
      position: absolute;
      right: 8px;
      background: transparent;
      border: none;
      color: var(--fg-secondary-color);
      cursor: pointer;
      border-radius: 50%;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background-color: var(--bg-hover-color);
        color: var(--fg-primary-color);
      }
    }
  }

  .popover-body {
    padding: 16px;
    text-align: left;
    max-height: 200px;
    overflow-y: auto;

    .translation {
      font-size: 1rem;
      color: var(--fg-primary-color);
      margin-bottom: 12px;
      line-height: 1.4;
    }
    .ai-section {
      margin-top: 12px;
      border-top: 1px dashed var(--border-secondary-color);
      padding-top: 8px;

      .ai-subtitle {
        font-size: 0.85rem;
        color: var(--fg-secondary-color);
        margin-bottom: 4px;
      }
      .ai-rule,
      .ai-vocab {
        font-size: 0.9rem;
        color: var(--fg-primary-color);
        line-height: 1.4;
        margin-bottom: 6px;
        b {
          color: var(--fg-accent-color);
        }
      }
    }
  }

  .popover-footer {
    padding: 8px 12px;
    background-color: var(--bg-secondary-color);
    border-top: 1px solid var(--border-secondary-color);
    display: flex;
    justify-content: space-between;
    align-items: center;

    .pos-badge {
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 500;
      background-color: rgba(59, 130, 246, 0.15);
      color: #3b82f6;

      &.pos-verb {
        color: #ef4444;
        background-color: rgba(239, 68, 68, 0.15);
      }
      &.pos-pronoun {
        color: #8b5cf6;
        background-color: rgba(139, 92, 246, 0.15);
      }
      &.pos-noun {
        color: #3b82f6;
        background-color: rgba(59, 130, 246, 0.15);
      }
      &.pos-default {
        color: var(--fg-primary-color);
        background-color: var(--bg-overlay-secondary-color);
      }
    }
  }
}

.hint-action {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-accent-color);
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
  cursor: pointer;

  svg {
    font-size: 1.4rem;
  }
}

.ml-2 {
  margin-left: 8px;
}

.next-btn {
  font-size: 1.1rem;
  padding: 12px 32px;
  border-radius: 99px;
}

.fade-zoom-enter-active,
.fade-zoom-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-zoom-enter-from,
.fade-zoom-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.9) translateY(10px);
}

.fade-enter-active {
  transition: opacity 0.2s;
}
.fade-leave-active {
  transition: opacity 0.05s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.blink {
  animation: blink-anim 2s infinite;
}
@keyframes blink-anim {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}
</style>
