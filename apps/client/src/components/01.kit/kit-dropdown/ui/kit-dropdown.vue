<script setup lang="ts">
import { onClickOutside, onKeyStroke } from '@vueuse/core'

interface Props {
  modelValue?: boolean
  placement?: 'left' | 'right' | 'center'
  width?: string | number
  closeOnContentClick?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  placement: 'right',
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

const containerRef = ref<HTMLElement | null>(null)

onClickOutside(containerRef, () => {
  isOpen.value = false
})

onKeyStroke('Escape', (e) => {
  if (isOpen.value) {
    e.preventDefault()
    isOpen.value = false
  }
})

function toggle() {
  isOpen.value = !isOpen.value
}

function handleContentClick() {
  if (props.closeOnContentClick) {
    isOpen.value = false
  }
}

const contentStyle = computed(() => {
  const styles: Record<string, string> = {
    width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  }

  if (props.placement === 'right') {
    styles.right = '0'
  }
  else if (props.placement === 'left') {
    styles.left = '0'
  }
  else if (props.placement === 'center') {
    styles.left = '50%'
    styles.transform = 'translateX(-50%)'
  }

  return styles
})

defineExpose({ close: () => isOpen.value = false, open: () => isOpen.value = true })
</script>

<template>
  <div ref="containerRef" class="kit-dropdown">
    <!-- Триггер -->
    <div
      class="dropdown-trigger"
      :class="{ 'is-active': isOpen }"
      @click="toggle"
    >
      <slot name="activator" :props="{ isOpen, toggle }" />
    </div>

    <!-- Меню -->
    <Transition name="dropdown-zoom">
      <div
        v-if="isOpen"
        class="dropdown-menu"
        :class="[`placement-${placement}`]"
        :style="contentStyle"
        @click="handleContentClick"
      >
        <div class="dropdown-menu-inner">
          <slot />
        </div>
      </div>
    </Transition>
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
  position: absolute;
  top: 100%;
  margin-top: 8px;
  z-index: 1000;
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
    opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: top center;
}

.dropdown-zoom-enter-from,
.dropdown-zoom-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-5px);
}

.dropdown-zoom-enter-to,
.dropdown-zoom-leave-from {
  opacity: 1;
  transform: scale(1) translateY(0);
}

.placement-left .dropdown-zoom-enter-active {
  transform-origin: top left;
}
.placement-right .dropdown-zoom-enter-active {
  transform-origin: top right;
}
</style>
