<script setup lang="ts">
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { Icon } from '@iconify/vue'
import { computed, onUnmounted, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReaderStore } from '~/components/05.modules/reader/store/reader.store'
import { useTts } from '~/shared/composables/use-tts'
import { useAnalysisStore } from '~/shared/store/analysis.store'

const props = defineProps<{
  box: any
  referenceEl: HTMLElement | null
}>()

const floating = ref<HTMLElement | null>(null)

const { x, y, strategy } = useFloating(toRef(props, 'referenceEl'), floating, {
  placement: 'bottom',
  strategy: 'fixed',
  middleware: [offset(8), flip(), shift({ padding: 12 })],
  whileElementsMounted: autoUpdate,
})

const style = computed(() => {
  const isPositioned = x.value != null && y.value != null
  return {
    position: strategy.value,
    top: `${y.value ?? 0}px`,
    left: `${x.value ?? 0}px`,
    visibility: isPositioned ? 'visible' as const : 'hidden' as const,
  }
})

const { t } = useI18n()
const analysisStore = useAnalysisStore()
const { speak, stop, isPlaying, isLoading } = useTts()

function analyzeSentence() {
  if (props.box?.text) {
    const readerStore = useReaderStore()
    const text = props.box.text.replace(/\n+/g, '')
    let context = ''

    // Ищем соседей в OCR-блоках
    const blocks = readerStore.currentPage?.ocrBlocks || []
    const idx = blocks.findIndex(b => b.id === props.box.id)
    if (idx !== -1) {
      const prev = idx > 0 ? blocks[idx - 1].text.replace(/\n+/g, '') : ''
      const next = idx < blocks.length - 1 ? blocks[idx + 1].text.replace(/\n+/g, '') : ''
      context = `${prev} [${text}] ${next}`.trim()
    }

    analysisStore.closePopover()
    analysisStore.handleSentenceAnalysis(text, context)
  }
}

function playTTS() {
  if (props.box?.text) {
    if (isPlaying.value || isLoading.value) {
      stop()
    }
    else {
      speak(props.box.text.replace(/\n+/g, ''))
    }
  }
}

onUnmounted(() => stop())
</script>

<template>
  <Transition name="fade">
    <div
      v-if="box && referenceEl"
      ref="floating"
      class="bubble-popover-container"
      :style="style"
    >
      <div class="bubble-actions" @mousedown.stop @touchstart.stop>
        <button class="action-btn" :title="t('analysis.aiAnalysis')" @click.stop="analyzeSentence">
          <Icon icon="mdi:robot-outline" />
        </button>
        <button class="action-btn" :title="t('analysis.voice')" @click.stop="playTTS">
          <Icon
            :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
            :class="{ 'spin-animation': isLoading, 'pulse-animation': isPlaying }"
          />
        </button>
      </div>

      <div class="bubble-popover js-tooltip-selectable">
        <div class="bubble-popover-text" v-html="box.html || box.text.replace(/\n+/g, '')" />
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.bubble-popover-container {
  position: fixed;
  z-index: var(--z-modal, 1250);
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: none;
}

.bubble-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: auto;

  .action-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background-color: rgba(var(--bg-tertiary-color-rgb, 33, 38, 45), 0.95);
    backdrop-filter: blur(16px);
    border: 1px solid var(--border-primary-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    color: var(--fg-primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 1.4rem;

    &:hover {
      background-color: var(--bg-hover-color);
      color: var(--fg-accent-color);
      transform: scale(1.05);
    }
  }
}

.bubble-popover {
  background-color: rgba(var(--bg-tertiary-color-rgb, 33, 38, 45), 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-primary-color);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  padding: 12px;
  border-radius: 12px;
  max-width: 400px;
  width: max-content;
  color: var(--fg-primary-color);
  user-select: none;
  pointer-events: auto;

  .bubble-popover-text {
    font-size: 1.25rem;
    line-height: 1.5;
    text-align: left;
    writing-mode: horizontal-tb;
    word-break: break-word;
    cursor: pointer;

    :deep(.sentence) {
      display: inline;
      cursor: pointer;
      border-radius: 4px;
      transition: background-color 0.2s ease;
      &:hover,
      &.is-hovered {
        background-color: var(--bg-hover-color);
      }
    }

    :deep(.word) {
      padding: 0;
      border-radius: 4px;
      transition:
        background-color 0.1s,
        color 0.1s;
      &.add-space {
        margin-right: 0.25em;
      }
      &.is-punctuation {
        cursor: default;
      }
      &.is-active {
        background-color: var(--fg-accent-color);
        color: var(--bg-primary-color);
        font-weight: bold;
      }
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.spin-animation {
  animation: spin 1s linear infinite;
}

.pulse-animation {
  animation: pulse-op 1.2s ease-in-out infinite;
  color: var(--fg-accent-color);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse-op {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.85;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (max-width: 600px) {
  .bubble-popover-container {
    flex-direction: column-reverse;
    align-items: flex-end;
  }

  .bubble-actions {
    flex-direction: row;
  }
}
</style>
