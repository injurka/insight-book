<script setup lang="ts">
import type { Ref } from 'vue'
import { autoUpdate, flip, size as floatingSize, offset, useFloating } from '@floating-ui/vue'
import { Icon } from '@iconify/vue'
import { onClickOutside } from '@vueuse/core'
import { computed, inject, onUnmounted, ref, useSlots } from 'vue'

export interface KitSelectOption<T = Record<string, unknown>> {
  label: string
  value: string | number
  icon?: string
  group?: string
  deletable?: boolean
  meta?: T
}

interface Props {
  options: KitSelectOption[]
  size?: 'xs' | 'sm' | 'md' | 'lg'
  color?: 'primary' | 'secondary' | 'accent' | 'error' | 'success' | 'warning' | 'info' | 'default'
  icon?: string
  prependIcon?: string
  multiple?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  color: 'default',
  multiple: false,
})

const emit = defineEmits<{
  (e: 'delete', option: KitSelectOption): void
}>()

const modelValue = defineModel<string | number | (string | number)[]>()

const slots = useSlots()
const isOpen = ref(false)
const referenceRef = ref<HTMLElement | null>(null)
const floatingRef = ref<HTMLElement | null>(null)

const dialogZIndex = inject<Ref<number> | undefined>('kit-dialog-z-index', undefined)
const dropdownZIndex = computed(() => dialogZIndex ? dialogZIndex.value + 10 : undefined)

const finalPrependIcon = computed(() => props.icon || props.prependIcon)
const hasPrepend = computed(() => !!finalPrependIcon.value || !!slots.prepend || !!slots.icon)

const selectedLabel = computed(() => {
  if (props.multiple && Array.isArray(modelValue.value)) {
    if (modelValue.value.length === 0)
      return ''

    return modelValue.value.map((v) => {
      const opt = props.options.find(o => o.value === v)

      return opt ? opt.label : ''
    }).filter(Boolean).join(', ')
  }

  const opt = props.options.find(o => o.value === modelValue.value)

  return opt ? opt.label : ''
})

const groupedOptions = computed(() => {
  const hasGroups = props.options.some(o => !!o.group)
  if (!hasGroups) {
    return [{ group: null, items: props.options }]
  }

  const groupsMap = new Map<string, KitSelectOption[]>()
  for (const opt of props.options) {
    const g = opt.group || ''
    if (!groupsMap.has(g))
      groupsMap.set(g, [])
    groupsMap.get(g)!.push(opt)
  }

  return Array.from(groupsMap.entries()).map(([group, items]) => ({
    group: group || null,
    items,
  }))
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
    const current = Array.isArray(modelValue.value) ? modelValue.value : []
    if (val === 'all') {
      modelValue.value = ['all']

      return
    }

    const isSelected = current.includes(val)
    let next = isSelected ? current.filter(v => v !== val) : [...current, val]
    next = next.filter(v => v !== 'all')
    if (next.length === 0)
      next = ['all']

    modelValue.value = next
  }
  else {
    modelValue.value = val
    isOpen.value = false
  }
}

function onDeleteOption(opt: KitSelectOption) {
  emit('delete', opt)
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
        color && color !== 'default' ? `kit-select-trigger--color-${color}` : '',
        { 'is-open': isOpen, 'has-prepend': hasPrepend },
      ]"
      @click="toggle"
    >
      <div class="label-wrapper">
        <span v-if="hasPrepend" class="select-prepend">
          <slot name="prepend">
            <slot name="icon">
              <Icon v-if="finalPrependIcon" :icon="finalPrependIcon" class="select-prepend-icon" />
            </slot>
          </slot>
        </span>
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
              v-for="gGroup in groupedOptions"
              :key="gGroup.group || 'default'"
              class="kit-select-group"
            >
              <div v-if="gGroup.group" class="kit-select-group-header">
                {{ gGroup.group }}
              </div>
              <div
                v-for="opt in gGroup.items"
                :key="opt.value"
                class="kit-select-option"
                :class="{ 'is-selected': multiple ? (Array.isArray(modelValue) && modelValue.includes(opt.value)) : opt.value === modelValue }"
                @click.stop="selectOption(opt.value)"
              >
                <div class="option-label-content">
                  <Icon v-if="opt.icon" :icon="opt.icon" class="option-icon" />
                  <span class="option-label-text">{{ opt.label }}</span>
                </div>
                <button
                  v-if="opt.deletable"
                  type="button"
                  class="option-delete-btn"
                  title="Удалить"
                  @click.stop="onDeleteOption(opt)"
                >
                  <Icon icon="mdi:close" />
                </button>
              </div>
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

  &--color-primary {
    background-color: rgba(var(--bg-primary-color-rgb, 13, 17, 23), 0.75);
    background-color: color-mix(in srgb, var(--bg-primary-color) 75%, transparent);
  }

  &--color-secondary {
    background-color: rgba(var(--bg-secondary-color-rgb, 22, 27, 34), 0.75);
    background-color: color-mix(in srgb, var(--bg-secondary-color) 75%, transparent);
  }

  &--color-accent {
    background-color: rgba(var(--bg-accent-color-rgb, 48, 33, 61), 0.75);
    background-color: color-mix(in srgb, var(--bg-accent-color) 75%, transparent);
  }

  @each $name in (error, success, warning, info) {
    &--color-#{$name} {
      background-color: rgba(var(--bg-#{$name}-color-rgb), 0.75);
      background-color: color-mix(in srgb, var(--bg-#{$name}-color) 75%, transparent);
    }
  }
}

.select-prepend {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--fg-secondary-color);
}

.select-prepend-icon {
  font-size: 1.25em;
  flex-shrink: 0;
}

.option-icon {
  font-size: 1.15em;
  margin-right: 6px;
  flex-shrink: 0;
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

.kit-select-group + .kit-select-group {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--border-secondary-color);
}

.kit-select-group-header {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--fg-muted-color);
  padding: 4px 10px 4px;
  user-select: none;
}

.kit-select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.option-label-content {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.option-label-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.option-delete-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 4px;
  margin-left: 8px;
  border-radius: 4px;
  color: var(--fg-secondary-color);
  font-size: 0.9em;
  transition:
    color 0.2s,
    background-color 0.2s;

  &:hover {
    color: var(--fg-error-color, #ff4d4f);
    background-color: rgba(255, 77, 79, 0.15);
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
