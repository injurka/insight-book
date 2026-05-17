<script setup lang="ts">
import type { Placement } from '@floating-ui/vue'
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { onClickOutside, onKeyStroke } from '@vueuse/core'

interface Props {
  modelValue?: boolean
  placement?: Placement
  width?: string | number
  closeOnContentClick?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  placement: 'bottom-start',
  width: '220px',
  closeOnContentClick: true,
})

const emit = defineEmits(['update:modelValue'])

const internalOpen = ref(false)

const isOpen = computed({
  get: () => props.modelValue !== undefined ? props.modelValue : internalOpen.value,
  set: (val) => {
    internalOpen.value = val
    emit('update:modelValue', val)
  },
})

const referenceRef = ref<HTMLElement | null>(null)
const floatingRef = ref<HTMLElement | null>(null)

const { x, y, strategy, placement: finalPlacement } = useFloating(referenceRef, floatingRef, {
  placement: computed(() => props.placement),
  whileElementsMounted: autoUpdate,
  middleware: [
    offset(8),
    flip(),
    shift({ padding: 8 }),
  ],
  open: isOpen,
})

onClickOutside(floatingRef, (e) => {
  if (referenceRef.value && referenceRef.value.contains(e.target as Node)) {
    return
  }
  isOpen.value = false
}, { ignore: [referenceRef, '.kit-select-dropdown'] })

onKeyStroke('Escape', (e) => {
  if (isOpen.value) {
    e.preventDefault()
    isOpen.value = false
  }
})

function toggle() {
  isOpen.value = !isOpen.value
}

function handleContentClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.kit-select-wrapper')) {
    return
  }

  if (props.closeOnContentClick) {
    isOpen.value = false
  }
}

const contentStyle = computed(() => {
  const isPositioned = x.value != null && y.value != null

  return {
    position: strategy.value,
    top: isPositioned ? `${y.value}px` : '0',
    left: isPositioned ? `${x.value}px` : '0',
    width: typeof props.width === 'number' ? `${props.width}px` : props.width,
    visibility: isPositioned ? 'visible' as const : 'hidden' as const,
  }
})

defineExpose({ close: () => isOpen.value = false, open: () => isOpen.value = true })

onUnmounted(() => {
  isOpen.value = false
})
</script>

<template>
  <div class="kit-dropdown">
    <div
      ref="referenceRef"
      class="dropdown-trigger"
      :class="{ 'is-active': isOpen }"
      @click="toggle"
    >
      <slot name="activator" :props="{ isOpen, toggle }" />
    </div>

    <Teleport to="body">
      <Transition name="dropdown-zoom">
        <div
          v-if="isOpen"
          ref="floatingRef"
          class="dropdown-menu"
          :data-placement="finalPlacement"
          :style="contentStyle"
          @click="handleContentClick"
        >
          <div class="dropdown-menu-inner">
            <slot />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.kit-dropdown {
  position: relative;
  display: inline-flex;
}

.dropdown-trigger {
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: opacity 0.2s;

  &.is-active {
    opacity: 0.7;
  }
}

.dropdown-menu {
  z-index: var(--z-dropdown, 1000);

  transform-origin: top center;

  &[data-placement^='top'] {
    transform-origin: bottom center;
  }
  &[data-placement^='bottom'] {
    transform-origin: top center;
  }
  &[data-placement='bottom-start'],
  &[data-placement='top-start'] {
    transform-origin: left;
  }
  &[data-placement='bottom-end'],
  &[data-placement='top-end'] {
    transform-origin: right;
  }
}

.dropdown-menu-inner {
  background-color: rgba(var(--bg-tertiary-color-rgb), 1);
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(var(--border-primary-color-rgb, 48, 54, 61), 0.4);
  border-radius: 12px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06),
    0 10px 15px -3px rgba(0, 0, 0, 0.1);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  color: var(--fg-primary-color);

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.dropdown-zoom-enter-active,
.dropdown-zoom-leave-active {
  transition:
    opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-zoom-enter-from,
.dropdown-zoom-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(0);
}

.dropdown-zoom-enter-to,
.dropdown-zoom-leave-from {
  opacity: 1;
  transform: scale(1) translateY(0);
}
</style>
