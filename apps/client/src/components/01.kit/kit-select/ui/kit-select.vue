<script setup lang="ts">
import { autoUpdate, flip, size as floatingSize, offset, useFloating } from '@floating-ui/vue'
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'
import { computed, ref } from 'vue'

interface Option {
  label: string
  value: string | number
}

interface Props {
  modelValue: string | number
  options: Option[]
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const referenceRef = ref<HTMLElement | null>(null)
const floatingRef = ref<HTMLElement | null>(null)

const selectedLabel = computed(() => {
  const opt = props.options.find(o => o.value === props.modelValue)
  return opt ? opt.label : ''
})

const { x, y, strategy } = useFloating(referenceRef, floatingRef, {
  placement: 'bottom-start',
  whileElementsMounted: autoUpdate,
  open: isOpen,
  middleware: [
    offset(4),
    flip(),
    floatingSize({
      apply({ rects, elements }) {
        Object.assign(elements.floating.style, {
          width: `${rects.reference.width}px`,
        })
      },
    }),
  ],
})

onClickOutside(floatingRef, (e) => {
  // Игнорируем клик по самому триггеру (так как там срабатывает toggle)
  if (referenceRef.value && referenceRef.value.contains(e.target as Node)) {
    return
  }
  isOpen.value = false
}, { ignore: [referenceRef] })

function toggle() {
  isOpen.value = !isOpen.value
}

function selectOption(val: string | number) {
  emit('update:modelValue', val)
  isOpen.value = false
}
</script>

<template>
  <div class="kit-select-wrapper">
    <div
      ref="referenceRef"
      class="kit-select-trigger"
      :class="[
        `kit-select-trigger--size-${size}`,
        { 'is-open': isOpen },
      ]"
      @click="toggle"
    >
      <span class="selected-label">{{ selectedLabel }}</span>
      <Icon
        icon="mdi:chevron-down"
        class="trigger-icon"
        :class="{ 'is-rotated': isOpen }"
      />
    </div>

    <Teleport to="body">
      <Transition name="select-fade">
        <div
          v-if="isOpen"
          ref="floatingRef"
          class="kit-select-dropdown"
          :style="{
            position: strategy,
            top: `${y ?? 0}px`,
            left: `${x ?? 0}px`,
            visibility: x == null ? 'hidden' : 'visible',
          }"
        >
          <div class="kit-select-options-list">
            <div
              v-for="opt in options"
              :key="opt.value"
              class="kit-select-option"
              :class="{ 'is-selected': opt.value === modelValue }"
              @click.stop="selectOption(opt.value)"
            >
              {{ opt.label }}
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.kit-select-wrapper {
  position: relative;
  width: 100%;
}

.kit-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  box-sizing: border-box;
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  transition:
    border-color 0.2s,
    background-color 0.2s,
    box-shadow 0.2s;

  &:hover,
  &.is-open {
    border-color: var(--fg-accent-color);
  }

  &--size-xs {
    height: 28px;
    padding: 0 8px;
    font-size: 0.8rem;
  }

  &--size-sm {
    height: 32px;
    padding: 0 10px;
    font-size: 0.85rem;
  }

  &--size-md {
    height: 38px;
    padding: 0 12px;
    font-size: 0.875rem;
  }

  &--size-lg {
    height: 44px;
    padding: 0 16px;
    font-size: 1rem;
  }
}

.selected-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-grow: 1;
  text-align: left;
}

.trigger-icon {
  flex-shrink: 0;
  margin-left: 8px;
  font-size: 1.2rem;
  color: var(--fg-secondary-color);
  transition: transform 0.2s ease;

  &.is-rotated {
    transform: rotate(180deg);
  }
}

.kit-select-dropdown {
  /* Большой z-index, чтобы перекрывать KitDropdown и другие элементы */
  z-index: 10005;
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.kit-select-options-list {
  max-height: 250px;
  overflow-y: auto;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.kit-select-option {
  padding: 8px 10px;
  font-size: 0.85rem;
  cursor: pointer;
  color: var(--fg-primary-color);
  border-radius: 6px;
  transition:
    background-color 0.2s,
    color 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
  }

  &.is-selected {
    background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.15);
    color: var(--fg-accent-color);
    font-weight: 500;
  }
}

.select-fade-enter-active,
.select-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.select-fade-enter-from,
.select-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
