<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useTts } from '~/shared/composables/use-tts'
import { useAnalysisStore } from '~/shared/store/analysis.store'

const analysisStore = useAnalysisStore()
const { speak, stop, isPlaying, isLoading } = useTts()
const { t } = useI18n()

const popoverRef = ref<HTMLElement | null>(null)
const popoverPos = ref({ top: '-9999px', left: '-9999px', transform: 'none' })

const offset = 24

const checkTextSelection = useDebounceFn(() => {
  const selection = window.getSelection()

  if (!selection || selection.isCollapsed) {
    analysisStore.closeSelectionTooltip()
    return
  }

  const text = selection.toString().trim()
  if (!text || !/[\p{L}\p{N}]/u.test(text)) {
    analysisStore.closeSelectionTooltip()
    return
  }

  let node = selection.anchorNode
  let isSelectable = false

  while (node && node !== document.body) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains('js-tooltip-selectable')) {
      isSelectable = true
      break
    }
    node = node.parentNode
  }

  if (!isSelectable) {
    return
  }

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()

  if (rect.width === 0 || rect.height === 0) {
    analysisStore.closeSelectionTooltip()
    return
  }

  if (analysisStore.wordPopover) {
    analysisStore.closePopover()
  }

  analysisStore.selectionTooltip = { text, targetRect: rect }
}, 250)

function analyzeFragment() {
  if (!analysisStore.selectionTooltip)
    return
  const text = analysisStore.selectionTooltip.text
  let context = ''

  const selection = window.getSelection()
  if (selection && selection.anchorNode) {
    const span = selection.anchorNode.parentElement?.closest('.sentence')

    if (span) {
      const prev = span.previousElementSibling?.textContent || ''
      const next = span.nextElementSibling?.textContent || ''
      context = `${prev} [${text}] ${next}`.trim()
    }
  }

  window.getSelection()?.removeAllRanges()

  analysisStore.closeSelectionTooltip()
  analysisStore.handleSentenceAnalysis(text, context)
}

function playTTS() {
  if (!analysisStore.selectionTooltip)
    return

  if (isPlaying.value || isLoading.value) {
    stop()
  }
  else {
    speak(analysisStore.selectionTooltip.text)
  }
}

watch(
  () => analysisStore.selectionTooltip,
  async (val) => {
    if (!val) {
      popoverPos.value = { top: '-9999px', left: '-9999px', transform: 'none' }
      if (isPlaying.value || isLoading.value) {
        stop()
      }
      return
    }

    await nextTick()
    if (!popoverRef.value || !val.targetRect)
      return

    const rect = val.targetRect
    const popRect = popoverRef.value.getBoundingClientRect()
    const ww = window.innerWidth
    const wh = window.innerHeight

    let left = rect.left + rect.width / 2

    const isMobile = ww < 600
    let top = isMobile ? rect.bottom + 8 : rect.top - popRect.height - offset

    if (isMobile) {
      if (top + popRect.height > wh - 10) {
        top = rect.top - popRect.height - offset
      }
    }
    else {
      if (top < 10) {
        top = rect.bottom + offset
      }
    }

    if (left - popRect.width / 2 < 10) {
      left = popRect.width / 2 + 10
    }
    else if (left + popRect.width / 2 > ww - 10) {
      left = ww - popRect.width / 2 - 10
    }

    popoverPos.value = {
      top: `${top}px`,
      left: `${left}px`,
      transform: 'translateX(-50%)',
    }
  },
  { deep: true },
)

onMounted(() => {
  document.addEventListener('selectionchange', checkTextSelection)
})

onUnmounted(() => {
  document.removeEventListener('selectionchange', checkTextSelection)
  stop()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="analysisStore.selectionTooltip"
        ref="popoverRef"
        class="selection-tooltip"
        :style="popoverPos"
        @mousedown.stop
        @touchstart.stop
        @click.stop
      >
        <button class="tooltip-btn" :title="t('analysis.aiAnalysis')" @click="analyzeFragment">
          <Icon icon="mdi:robot-outline" />
          <span>{{ t('analysis.aiAnalysis') }}</span>
        </button>
        <div class="divider" />
        <button class="tooltip-btn" :title="t('analysis.voice')" @click="playTTS">
          <Icon
            :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
            :class="{ 'pulse-animation': isPlaying, 'spin-animation': isLoading }"
          />
          <span>{{ t('analysis.listen') }}</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.selection-tooltip {
  position: fixed;
  display: flex;
  align-items: center;
  background-color: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  z-index: var(--z-tooltip, 1400);
  padding: 4px 6px;
  pointer-events: auto;
}

.tooltip-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--fg-primary-color);
  padding: 6px 12px;
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover,
  &:active {
    background: rgba(var(--bg-accent-overlay-color-rgb), 0.1);
  }

  svg {
    font-size: 1.2rem;
  }
}

.divider {
  width: 1px;
  height: 20px;
  background-color: var(--border-primary-color);
  margin: 0 4px;
}

.pulse-animation {
  animation: pulse-op 1.2s ease-in-out infinite;
  transform-origin: center;
  display: inline-block;
  color: var(--fg-accent-color);
}

.spin-animation {
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes pulse-op {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.85);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
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
  transform: translateX(-50%) translateY(5px) !important;
}
</style>
