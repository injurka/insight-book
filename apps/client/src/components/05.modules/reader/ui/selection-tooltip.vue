<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useBooksStore } from '~/shared/store/books.store'

const store = useBooksStore()
const popoverRef = ref<HTMLElement | null>(null)
const popoverPos = ref({ top: '-9999px', left: '-9999px', transform: 'none' })

const isSpeaking = ref(false)

watch(
  () => store.selectionTooltip,
  async (val) => {
    if (!val) {
      popoverPos.value = { top: '-9999px', left: '-9999px', transform: 'none' }
      if (isSpeaking.value) {
        window.speechSynthesis.cancel()
        isSpeaking.value = false
      }
      return
    }

    await nextTick()
    if (!popoverRef.value || !val.targetRect)
      return

    const rect = val.targetRect
    const popRect = popoverRef.value.getBoundingClientRect()
    const ww = window.innerWidth

    let left = rect.left + rect.width / 2
    let top = rect.top - popRect.height - 8

    // Проверка, не уходит ли тултип за верхний край экрана
    if (top < 10) {
      top = rect.bottom + 8 // Показываем под текстом
    }

    // Проверка границ слева и справа
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

function analyzeFragment() {
  if (!store.selectionTooltip)
    return
  const text = store.selectionTooltip.text

  window.getSelection()?.removeAllRanges()

  store.closeSelectionTooltip()
  store.handleSentenceAnalysis(text)
}

function playTTS() {
  if (!store.selectionTooltip)
    return

  const text = store.selectionTooltip.text
  const lang = store.currentBook?.language || 'en'

  const langMap: Record<string, string> = {
    zh: 'zh-CN',
    ja: 'ja-JP',
    en: 'en-US',
    ru: 'ru-RU',
  }

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = langMap[lang.toLowerCase()] || lang
  utterance.rate = 0.9

  utterance.onstart = () => {
    isSpeaking.value = true
  }

  utterance.onend = () => {
    isSpeaking.value = false
  }

  window.speechSynthesis.speak(utterance)
}

onUnmounted(() => {
  window.speechSynthesis.cancel()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="store.selectionTooltip"
        ref="popoverRef"
        class="selection-tooltip"
        :style="popoverPos"
        @mousedown.stop
        @touchstart.stop
        @click.stop
      >
        <button class="tooltip-btn" title="Анализ ИИ" @click="analyzeFragment">
          <Icon icon="mdi:robot-outline" />
          <span>Анализ</span>
        </button>
        <div class="divider" />
        <button class="tooltip-btn" title="Озвучить" @click="playTTS">
          <Icon :icon="isSpeaking ? 'mdi:volume-high' : 'mdi:volume-medium'" :class="{ 'pulse-animation': isSpeaking }" />
          <span>Слушать</span>
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
  z-index: 1000;
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
  animation: pulse-op 1.5s infinite;
}

@keyframes pulse-op {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
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
