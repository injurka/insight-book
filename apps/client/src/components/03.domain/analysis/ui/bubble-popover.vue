<script setup lang="ts">
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { computed, ref, toRef } from 'vue'

const props = defineProps<{
  box: any
  referenceEl: HTMLElement | null
}>()

const floating = ref<HTMLElement | null>(null)

// Используем strategy: 'fixed', чтобы прокрутка внутри компонента не ломала координаты.
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
    // Скрываем попап, пока Floating UI не рассчитает координаты в первом кадре
    visibility: isPositioned ? 'visible' as const : 'hidden' as const,
  }
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="box && referenceEl"
      ref="floating"
      class="bubble-popover js-tooltip-selectable"
      :style="style"
    >
      <div class="bubble-popover-text" v-html="box.html || box.text.replace(/\n+/g, '')" />
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.bubble-popover {
  position: fixed;
  z-index: var(--z-modal, 1250);
  background-color: rgba(var(--bg-tertiary-color-rgb, 33, 38, 45), 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-primary-color);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  padding: 16px;
  border-radius: 12px;
  max-width: 400px;
  width: max-content;
  color: var(--fg-primary-color);
  cursor: default;

  .bubble-popover-text {
    font-size: 1.25rem;
    line-height: 1.5;
    text-align: left;
    writing-mode: horizontal-tb;
    word-break: break-word;

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
</style>
