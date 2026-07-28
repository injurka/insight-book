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

// --- 1. DOM Ссылки ---
const switcherRef = ref<HTMLElement | null>(null)
const buttonRefs = ref<Record<string | number, HTMLElement>>({})

// --- 2. Логика позиционирования (Glider) ---
const {
  gliderStyle,
  updatePosition,
  enableTransition,
  disableTransition,
} = useGlider(switcherRef, buttonRefs, model)

// --- 3. Логика компактного режима (Overflow) ---
const {
  isCompact,
  recalculate: recalculateCompactMode,
  observeParent,
  unobserveParent,
} = useCompactMode(switcherRef)

// --- 4. Обработчики ---
function handleItemClick(itemId: T) {
  if (props.disabled)
    return
  model.value = itemId
  emit('change', itemId)
}

// --- 5. Связывание реактивности (Оркестрация) ---
watch(isCompact, () => {
  disableTransition()
  updatePosition()
}, { flush: 'post' })

useResizeObserver(switcherRef, () => {
  disableTransition()
  updatePosition()
})

watch(() => props.items, () => {
  nextTick(() => {
    recalculateCompactMode()
    updatePosition()
  })
}, { deep: true })

// --- 6. Жизненный цикл ---
onMounted(() => {
  recalculateCompactMode()
  updatePosition()
  observeParent()

  nextTick(() => {
    // Включаем анимации с задержкой, чтобы при первичной отрисовке ползунок "не выезжал"
    setTimeout(enableTransition, 50)
  })
})

onUnmounted(() => {
  unobserveParent()
})
</script>

<template>
  <div
    ref="switcherRef"
    class="kit-view-switcher"
    :class="{
      'is-disabled': disabled,
      'is-full-width': fullWidth,
      'is-compact': isCompact,
    }"
  >
    <div class="kit-view-switcher-glider" :style="gliderStyle" />

    <button
      v-for="item in items"
      :key="item.id"
      :ref="el => (buttonRefs[item.id] = el as HTMLElement)"
      class="kit-view-switcher-button"
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
  transition: opacity 0.2s ease-out;
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

  &.is-measuring {
    position: absolute !important;
    visibility: hidden !important;
    display: inline-flex !important;
    width: max-content !important;
    max-width: none !important;

    .kit-view-switcher-button {
      flex: none !important;

      &.has-icon {
        .kit-view-switcher-label {
          display: inline !important;
        }
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

    &.has-icon {
      .kit-view-switcher-label {
        display: none !important;
      }
    }
  }
}
</style>
