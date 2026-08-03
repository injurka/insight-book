<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/index.ts'
import OnboardingStepLayout from './onboarding-step-layout.vue'

const emit = defineEmits<{
  next: []
}>()
const { t } = useI18n()

const isWordTranslated = ref(false)
const activeWordId = ref('felicidad')

const words = [
  { id: 'El', text: 'El' },
  { id: 'secreto', text: 'secreto' },
  { id: 'de', text: 'de' },
  { id: 'la', text: 'la' },
  { id: 'felicidad', text: 'felicidad' },
  { id: 'no', text: 'no' },
  { id: 'es', text: 'es' },
  { id: 'hacer', text: 'hacer' },
  { id: 'siempre', text: 'siempre' },
  { id: 'lo', text: 'lo' },
  { id: 'que', text: 'que' },
  { id: 'se', text: 'se' },
  { id: 'quiere', text: 'quiere', suffix: '.' },
]

interface MockDictEntry {
  tr: string
  trans: string
  pos: string
  posClass: string
  rule: string
}

const mockDict: Record<string, MockDictEntry> = {
  El: {
    tr: '[эль]',
    trans: 'Определенный артикль',
    pos: 'Артикль',
    posClass: 'pos-default',
    rule: 'Мужской род, единственное число.',
  },
  secreto: {
    tr: '[секрето]',
    trans: 'Секрет; тайна',
    pos: 'Существительное',
    posClass: 'pos-noun',
    rule: 'Мужской род. Происходит от лат. secretus.',
  },
  de: {
    tr: '[де]',
    trans: 'Из; от; о',
    pos: 'Предлог',
    posClass: 'pos-default',
    rule: 'Указывает на принадлежность или происхождение.',
  },
  la: {
    tr: '[ла]',
    trans: 'Определенный артикль',
    pos: 'Артикль',
    posClass: 'pos-default',
    rule: 'Женский род, единственное число.',
  },
  felicidad: {
    tr: '[фелисидад]',
    trans: 'Счастье; радость',
    pos: 'Существительное',
    posClass: 'pos-noun',
    rule: 'Женский род, абстрактное понятие.',
  },
  no: {
    tr: '[но]',
    trans: 'Нет; не',
    pos: 'Частица',
    posClass: 'pos-default',
    rule: 'Отрицательная частица.',
  },
  es: {
    tr: '[эс]',
    trans: 'Является; есть',
    pos: 'Глагол',
    posClass: 'pos-verb',
    rule: 'Форма глагола ser (быть) в 3-м лице ед.ч.',
  },
  hacer: {
    tr: '[асер]',
    trans: 'Делать; создавать',
    pos: 'Глагол',
    posClass: 'pos-verb',
    rule: 'Инфинитив. Нерегулярный глагол.',
  },
  siempre: {
    tr: '[сьемпре]',
    trans: 'Всегда; постоянно',
    pos: 'Наречие',
    posClass: 'pos-adj',
    rule: 'Наречие времени.',
  },
  lo: {
    tr: '[ло]',
    trans: 'То; это',
    pos: 'Местоимение',
    posClass: 'pos-pronoun',
    rule: 'Нейтральное местоимение.',
  },
  que: {
    tr: '[ке]',
    trans: 'Что; который',
    pos: 'Союз',
    posClass: 'pos-default',
    rule: 'Соединительный союз или относительное местоимение.',
  },
  se: {
    tr: '[се]',
    trans: 'Себя; себе',
    pos: 'Местоимение',
    posClass: 'pos-pronoun',
    rule: 'Возвратное местоимение 3-го лица.',
  },
  quiere: {
    tr: '[кьере]',
    trans: 'Хочет; желает',
    pos: 'Глагол',
    posClass: 'pos-verb',
    rule: 'Форма глагола querer (хотеть) в 3-м лице ед.ч.',
  },
}

const activeDict = computed(() => mockDict[activeWordId.value] || mockDict.felicidad)

function translateWord(id: string) {
  activeWordId.value = id
  isWordTranslated.value = true
}
</script>

<template>
  <OnboardingStepLayout
    :title="t('onboarding.step1_title')"
    :description="t('onboarding.step1_desc')"
    icon="mdi:magic-staff"
    icon-class="accent-icon"
  >
    <div class="interactive-zone">
      <div class="mock-sentence">
        <template v-for="w in words" :key="w.id">
          <div class="word-wrapper">
            <span
              class="clickable-word"
              :class="{ 'is-active': isWordTranslated && activeWordId === w.id }"
              @click="translateWord(w.id)"
            >{{ w.text }}</span><span v-if="w.suffix" class="suffix">{{ w.suffix }}</span>
          </div>
        </template>
      </div>

      <Transition name="fade-zoom" mode="out-in">
        <div v-if="!isWordTranslated" class="hint-container">
          <div class="hint-action blink" @click="translateWord('felicidad')">
            <Icon icon="mdi:cursor-pointer" />
            <span>{{ t('onboarding.step1_action') }}</span>
          </div>
        </div>

        <div v-else class="mock-word-popover word-popover">
          <div class="transcription-header">
            <span class="header-text">{{ activeDict.tr }}</span>
            <button class="close-btn" @click.stop="isWordTranslated = false">
              <Icon width="18" height="18" icon="mdi:chevron-down" />
            </button>
          </div>

          <div class="popover-content">
            <div class="popover-body">
              <div class="translation">
                {{ activeDict.trans }}
              </div>
              <div class="ai-section">
                <div class="ai-subtitle">
                  {{ t('onboarding.step1_grammar') }}
                </div>
                <div class="ai-rule">
                  <b>{{ activeDict.pos }}</b> — {{ activeDict.rule }}
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

    <!-- Фиксированная зона для кнопок внизу -->
    <div class="step-actions">
      <Transition name="fade" mode="out-in">
        <KitBtn
          v-if="isWordTranslated"
          color="primary"
          class="next-btn"
          @click="emit('next')"
        >
          {{ t('onboarding.next') }} <Icon icon="mdi:arrow-right" />
        </KitBtn>
      </Transition>
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
  height: 350px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.hint-container {
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.step-actions {
  height: 60px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mock-sentence {
  font-size: 1.4rem;
  font-family: 'Maple Mono CN', 'Courier New', monospace;
  color: var(--fg-primary-color);
  padding: 4px;
  border-radius: 4px;
  text-align: center;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  column-gap: 6px;
  row-gap: 8px;
  flex-shrink: 0;

  @include media-down(sm) {
    font-size: 1.25rem;
  }
}

.word-wrapper {
  display: inline-flex;
  align-items: baseline;
}

.clickable-word {
  cursor: pointer;
  border-radius: 4px;
  padding: 2px 4px;
  transition:
    background-color 0.2s,
    color 0.2s;

  &:hover {
    background: var(--bg-hover-color);
  }

  &.is-active {
    background-color: var(--fg-accent-color);
    color: var(--bg-primary-color);
    font-weight: bold;
  }
}

.suffix {
  margin-left: 1px;
}

.mock-word-popover {
  margin-top: 16px;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .transcription-header {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 16px 8px 16px;
    position: relative;
    min-height: 44px;

    .header-text {
      font-weight: 600;
      font-size: 1.15rem;
      color: var(--fg-accent-color);
      text-align: center;
    }

    .close-btn {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: var(--fg-secondary-color);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      padding: 6px;
      transition:
        background-color 0.2s,
        color 0.2s;

      &:hover {
        background-color: var(--bg-hover-color);
        color: var(--fg-primary-color);
      }
    }
  }

  .popover-body {
    padding: 8px 16px 16px 16px;
    text-align: left;

    .translation {
      font-size: 0.95rem;
      color: var(--fg-primary-color);
      line-height: 1.45;
      margin-bottom: 8px;
    }

    .ai-section {
      margin-top: 12px;
      border-top: 1px dashed var(--border-secondary-color);
      padding-top: 8px;

      .ai-subtitle {
        font-size: 0.85rem;
        color: var(--fg-secondary-color);
        margin-bottom: 4px;
        font-weight: 500;
      }

      .ai-rule {
        font-size: 0.85rem;
        color: var(--fg-primary-color);
        line-height: 1.4;
        b {
          color: var(--fg-accent-color);
        }
      }
    }
  }

  .popover-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background-color: var(--bg-secondary-color);
    border-top: 1px solid var(--border-secondary-color);

    .pos-badge {
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 500;
      white-space: nowrap;

      &.pos-noun {
        color: #3b82f6;
        background-color: rgba(59, 130, 246, 0.15);
      }
      &.pos-verb {
        color: #ef4444;
        background-color: rgba(239, 68, 68, 0.15);
      }
      &.pos-adj {
        color: #10b981;
        background-color: rgba(16, 185, 129, 0.15);
      }
      &.pos-pronoun {
        color: #8b5cf6;
        background-color: rgba(139, 92, 246, 0.15);
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
  transform: scale(0.95) translateY(-10px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
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
