<script setup lang="ts">
import type { Ref } from 'vue'
import { autoUpdate, flip, size as floatingSize, offset, useFloating } from '@floating-ui/vue'
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'

interface Option {
  label: string
  value: string | number
}

interface Props {
  modelValue: string | number | (string | number)[]
  options: Option[]
  size?: 'xs' | 'sm' | 'md' | 'lg'
  multiple?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  multiple: false,
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const referenceRef = ref<HTMLElement | null>(null)
const floatingRef = ref<HTMLElement | null>(null)

const dialogZIndex = inject<Ref<number> | undefined>('kit-dialog-z-index', undefined)
const dropdownZIndex = computed(() => dialogZIndex ? dialogZIndex.value + 10 : undefined)

const selectedLabel = computed(() => {
  if (props.multiple && Array.isArray(props.modelValue)) {
    if (props.modelValue.length === 0)
      return ''
    return props.modelValue.map((v) => {
      const opt = props.options.find(o => o.value === v)
      return opt ? opt.label : ''
    }).filter(Boolean).join(', ')
  }
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
          minWidth: `${rects.reference.width}px`,
        })
      },
    }),
  ],
})

onClickOutside(floatingRef, () => {
  isOpen.value = false
}, { ignore: [referenceRef] })

function toggle() {
  isOpen.value = !isOpen.value
}

function selectOption(val: string | number) {
  if (props.multiple) {
    const current = Array.isArray(props.modelValue) ? props.modelValue : []
    if (val === 'all') {
      emit('update:modelValue', ['all'])
      return
    }
    const isSelected = current.includes(val)
    let next = isSelected ? current.filter(v => v !== val) : [...current, val]
    next = next.filter(v => v !== 'all')
    if (next.length === 0) {
      next = ['all']
    }
    emit('update:modelValue', next)
  }
  else {
    emit('update:modelValue', val)
    isOpen.value = false
  }
}

onUnmounted(() => {
  isOpen.value = false
})
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
      <div class="label-wrapper">
        <span class="selected-label">{{ selectedLabel }}</span>
        <span v-if="multiple && Array.isArray(modelValue) && modelValue.length > 1 && !modelValue.includes('all')" class="count-badge">
          {{ modelValue.length }}
        </span>
      </div>
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
            zIndex: dropdownZIndex,
          }"
        >
          <div class="kit-select-options-list">
            <div
              v-for="opt in options"
              :key="opt.value"
              class="kit-select-option"
              :class="{ 'is-selected': multiple ? (Array.isArray(modelValue) && modelValue.includes(opt.value)) : opt.value === modelValue }"
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

.label-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-grow: 1;
  min-width: 0;
}

.selected-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: var(--fg-accent-color);
  color: var(--bg-primary-color);
  font-size: 0.75rem;
  font-weight: 700;
  border-radius: 99px;
  padding: 0 5px;
  height: 20px;
  min-width: 20px;
  flex-shrink: 0;
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
  z-index: calc(var(--z-dropdown, 1000) + 5);
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
  white-space: nowrap;
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
