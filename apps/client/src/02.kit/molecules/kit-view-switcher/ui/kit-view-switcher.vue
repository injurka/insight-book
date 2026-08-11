<script setup lang="ts" generic="T extends string | number">
import type { ViewSwitcherItem } from '../models/types'
import { Icon } from '@iconify/vue'
import { useResizeObserver } from '@vueuse/core'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useCompactMode } from '../composables/use-compact-mode'
import { useGlider } from '../composables/use-glider'

export interface Props<T extends string | number = string | number> {
  items: ViewSwitcherItem<T>[]
  disabled?: boolean
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props<T>>(), {
  disabled: false,
  fullWidth: false,
})

const emit = defineEmits<{
  (e: 'change', value: T): void
}>()

const model = defineModel<T>({ required: true })

const switcherRef = ref<HTMLElement | null>(null)
const isAnimating = ref(false)

const { gliderStyle, updatePosition } = useGlider(switcherRef)
const {
  isCompact,
  recalculate: recalculateCompactMode,
  observeParent,
  unobserveParent,
} = useCompactMode(switcherRef)

function handleItemClick(itemId: T) {
  if (props.disabled)
    return
  model.value = itemId
  emit('change', itemId)
}

watch(model, async () => {
  isAnimating.value = true
  await nextTick()
  updatePosition()
})

useResizeObserver(switcherRef, () => {
  isAnimating.value = false
  updatePosition()
})

watch(() => props.items, async () => {
  recalculateCompactMode()
  await nextTick()
  updatePosition()
}, { deep: true })

onMounted(async () => {
  recalculateCompactMode()
  observeParent()

  await nextTick()

  updatePosition()

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      isAnimating.value = true
    })
  })

  if (typeof document !== 'undefined' && document.fonts) {
    document.fonts.ready.then(async () => {
      recalculateCompactMode()
      await nextTick()
      isAnimating.value = false
      updatePosition()
    })
  }
})

onUnmounted(() => {
  unobserveParent()
})
</script>

<template>
  <div
    ref="switcherRef"
    class="kit-view-switcher"
    role="tablist"
    :class="{
      'is-animating': isAnimating,
      'is-disabled': disabled,
      'is-full-width': fullWidth,
      'is-compact': isCompact,
    }"
  >
    <div class="kit-view-switcher-glider" :style="gliderStyle" />

    <button
      v-for="item in items"
      :key="item.id"
      class="kit-view-switcher-button"
      role="tab"
      :aria-selected="model === item.id"
      :aria-label="item.label || String(item.id)"
      :title="item.label"
      :class="{
        'is-active': model === item.id,
        'has-icon': !!item.icon,
      }"
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

<style lang="scss" scoped>
.kit-view-switcher {
  position: relative;
  display: inline-flex;
  align-items: center;
  background-color: var(--bg-secondary-color);
  border-radius: 8px;
  padding: 4px;
  border: 1px solid var(--border-secondary-color);
  user-select: none;
  height: 46px;
  max-width: 100%;

  &.is-disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  &.is-full-width {
    display: flex;
    width: 100%;
  }

  &.is-compact {
    .kit-view-switcher-button.has-icon {
      .kit-view-switcher-label {
        display: none !important;
      }
    }
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
  transition: none;

  .kit-view-switcher.is-animating & {
    transition:
      width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
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
  overflow: hidden;

  .is-full-width & {
    flex: 1;
    min-width: 0;
    justify-content: center;
  }

  &:disabled {
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 1px;
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
  overflow: hidden;
  text-overflow: ellipsis;
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

    &.has-icon .kit-view-switcher-label {
      display: none !important;
    }
  }
}
</style>
