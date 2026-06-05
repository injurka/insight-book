<script setup lang="ts" generic="T extends string | number">
import type { ViewSwitcherItem } from '../models/types'
import { Icon } from '@iconify/vue'
import { useResizeObserver } from '@vueuse/core'

const props = withDefaults(defineProps<{
  items: ViewSwitcherItem<T>[]
  disabled?: boolean
  fullWidth?: boolean
}>(), {
  disabled: false,
  fullWidth: false,
})

const emit = defineEmits<{
  (e: 'change', value: T): void
}>()

const model = defineModel<T>({ required: true })

const switcherRef = ref<HTMLElement | null>(null)
const buttonRefs = ref<Record<string | number, HTMLElement>>({})

const gliderStyle = ref({
  opacity: 0,
  width: '0px',
  transform: 'translateX(0px)',
  transition: 'none',
})

function handleItemClick(itemId: T) {
  if (props.disabled)
    return

  model.value = itemId
  emit('change', itemId)
}

function updateGliderPosition() {
  const switcherEl = switcherRef.value
  if (!switcherEl)
    return

  const activeButton = buttonRefs.value[model.value]
  if (!activeButton) {
    gliderStyle.value.opacity = 0
    return
  }

  const switcherRect = switcherEl.getBoundingClientRect()
  const buttonRect = activeButton.getBoundingClientRect()

  const offsetLeft = buttonRect.left - switcherRect.left - switcherEl.clientLeft - 4

  const width = buttonRect.width

  gliderStyle.value = {
    ...gliderStyle.value,
    opacity: 1,
    width: `${width}px`,
    transform: `translateX(${offsetLeft}px)`,
  }
}

watch(model, () => {
  gliderStyle.value.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  updateGliderPosition()
}, { flush: 'post' })

useResizeObserver(switcherRef, () => {
  gliderStyle.value.transition = 'none'
  updateGliderPosition()
})

onMounted(() => {
  updateGliderPosition()

  nextTick(() => {
    setTimeout(() => {
      if (gliderStyle.value) {
        gliderStyle.value.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }
    }, 50)
  })
})
</script>

<template>
  <div
    ref="switcherRef"
    class="kit-view-switcher"
    :class="{
      'is-disabled': disabled,
      'is-full-width': fullWidth,
    }"
  >
    <div class="kit-view-switcher-glider" :style="gliderStyle" />

    <button
      v-for="item in items"
      :key="item.id"
      :ref="el => (buttonRefs[item.id] = el as HTMLElement)"
      class="kit-view-switcher-button"
      :class="{ 'is-active': model === item.id }"
      :disabled="disabled"
      @click="handleItemClick(item.id)"
    >
      <Icon
        v-if="item.icon"
        width="18"
        height="18"
        :icon="item.icon"
        class="kit-view-switcher-icon"
      />
      <span v-if="item.label" class="kit-view-switcher-label">{{ item.label }}</span>
    </button>
  </div>
</template>

<style lang="scss">
.kit-view-switcher {
  position: relative;
  display: inline-flex;
  align-items: center;
  background-color: var(--bg-secondary-color);
  border-radius: 8px;
  padding: 4px;
  border: 1px solid var(--border-secondary-color);
  user-select: none;
  transition: opacity 0.2s ease-out;
  height: 46px;

  &.is-disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  &.is-full-width {
    display: flex;
    width: 100%;
  }
}

.kit-view-switcher-glider {
  position: absolute;
  top: 4px;
  bottom: 4px;
  height: calc(100% - 8px);
  background-color: var(--bg-primary-color);
  border-radius: 8px;
  z-index: 1;
  opacity: 0;
}

.kit-view-switcher-button {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  background-color: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  min-height: 36px;

  .is-full-width & {
    flex: 1;
    justify-content: center;
  }

  &:disabled {
    cursor: not-allowed;
  }

  &.is-active {
    color: var(--fg-accent-color);
    font-weight: 600;
  }

  &:not(.is-active):hover:not(:disabled) {
    color: var(--fg-primary-color);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
}

.kit-view-switcher-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.kit-view-switcher-label {
  transition: color 0.3s ease;
}

@include media-down(sm) {
  .kit-view-switcher {
    &:not(.is-full-width) {
      display: flex;
      width: 100%;
    }
  }

  .kit-view-switcher-button {
    &:not(.is-full-width .kit-view-switcher-button) {
      flex: 1;
      justify-content: center;
    }

    padding: 8px 12px;

    .kit-view-switcher-label {
      display: none;
    }
  }
}
</style>
