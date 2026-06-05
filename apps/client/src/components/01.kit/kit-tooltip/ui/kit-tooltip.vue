<script setup lang="ts">
import { arrow, autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { useMediaQuery } from '@vueuse/core'
import { computed, onUnmounted, ref } from 'vue'

interface Props {
  text?: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'top',
  disabled: false,
})

const referenceRef = ref<HTMLElement | null>(null)
const floatingRef = ref<HTMLElement | null>(null)
const arrowRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)

const isHoverable = useMediaQuery('(hover: hover)')

const { x, y, strategy, middlewareData, placement: finalPlacement } = useFloating(referenceRef, floatingRef, {
  placement: props.placement,
  whileElementsMounted: autoUpdate,
  middleware: [
    offset(8),
    flip(),
    shift({ padding: 8 }),
    arrow({ element: arrowRef }),
  ],
  open: isVisible,
})

let timeout: ReturnType<typeof setTimeout>

function show() {
  if (props.disabled || !props.text || !isHoverable.value)
    return
  clearTimeout(timeout)
  timeout = setTimeout(() => {
    isVisible.value = true
  }, 200)
}

function hide() {
  clearTimeout(timeout)
  isVisible.value = false
}

const floatingStyle = computed(() => {
  const isPositioned = x.value != null && y.value != null

  return {
    position: strategy.value,
    top: isPositioned ? `${y.value}px` : '0',
    left: isPositioned ? `${x.value}px` : '0',
    width: 'max-content',
    visibility: isPositioned ? 'visible' as const : 'hidden' as const,
  }
})

const arrowStyle = computed(() => {
  if (!middlewareData.value.arrow)
    return {}
  const { x: arrowX, y: arrowY } = middlewareData.value.arrow
  const staticSide = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
  }[finalPlacement.value.split('-')[0]]

  return {
    left: arrowX != null ? `${arrowX}px` : '',
    top: arrowY != null ? `${arrowY}px` : '',
    [staticSide as string]: '-4px',
  }
})

onUnmounted(() => {
  hide()
})
</script>

<template>
  <div
    class="kit-tooltip-wrapper"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
    @click="hide"
  >
    <div ref="referenceRef" class="kit-tooltip-trigger">
      <slot />
    </div>

    <Teleport to="body">
      <Transition name="tooltip-fade">
        <div
          v-if="isVisible"
          ref="floatingRef"
          class="kit-tooltip-floating"
          :data-placement="finalPlacement"
          :style="floatingStyle"
          role="tooltip"
        >
          <slot name="content">
            {{ text }}
          </slot>
          <div ref="arrowRef" class="kit-tooltip-arrow" :style="arrowStyle" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.kit-tooltip-wrapper {
  display: inline-flex;
}

.kit-tooltip-trigger {
  display: inline-flex;

  :deep(.dialog-icon-btn) {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.kit-tooltip-floating {
  z-index: var(--z-tooltip, 1400);
  background-color: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  pointer-events: none;
  max-width: 250px;
  white-space: normal;
  text-align: center;
  border: 1px solid var(--border-secondary-color);
  transform-origin: center;
}

.kit-tooltip-arrow {
  position: absolute;
  width: 8px;
  height: 8px;
  background-color: var(--bg-tertiary-color);
  transform: rotate(45deg);
}

.kit-tooltip-floating[data-placement^='top'] .kit-tooltip-arrow {
  border-bottom: 1px solid var(--border-secondary-color);
  border-right: 1px solid var(--border-secondary-color);
}

.kit-tooltip-floating[data-placement^='bottom'] .kit-tooltip-arrow {
  border-top: 1px solid var(--border-secondary-color);
  border-left: 1px solid var(--border-secondary-color);
}

.kit-tooltip-floating[data-placement^='left'] .kit-tooltip-arrow {
  border-top: 1px solid var(--border-secondary-color);
  border-right: 1px solid var(--border-secondary-color);
}

.kit-tooltip-floating[data-placement^='right'] .kit-tooltip-arrow {
  border-bottom: 1px solid var(--border-secondary-color);
  border-left: 1px solid var(--border-secondary-color);
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
