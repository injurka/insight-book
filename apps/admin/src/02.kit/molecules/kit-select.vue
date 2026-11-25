<script setup lang="ts">
export interface Props {
  modelValue?: string | number | null
  options: { value: string | number, label: string }[]
  placeholder?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onChange(val: unknown) {
  emit('update:modelValue', String(val ?? ''))
}
</script>

<template>
  <v-select
    :model-value="props.modelValue ?? ''"
    :items="options"
    item-title="label"
    item-value="value"
    density="compact"
    variant="outlined"
    hide-details="auto"
    class="kit-select"
    :disabled="disabled"
    :placeholder="placeholder"
    @update:model-value="onChange"
  />
</template>

<style scoped>
.kit-select :deep(.v-field) {
  background-color: var(--bg-primary-color, #f3efe9) !important;
  border-radius: 6px !important;
  font-size: 14px;
  color: var(--fg-primary-color, #4a443c) !important;
}

.kit-select :deep(.v-field__input) {
  padding: 0 4px 0 12px !important;
  min-height: 40px !important;
  display: flex;
  align-items: center !important;
}

.kit-select :deep(.v-field__input input) {
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  min-height: 0 !important;
  width: auto !important;
}

.kit-select :deep(.v-select__selection) {
  margin: 0 !important;
  max-width: 100%;
}

.kit-select :deep(.v-select__selection-text) {
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kit-select :deep(.v-field__append-inner) {
  padding: 0 10px 0 0 !important;
  align-items: center !important;
}

.kit-select :deep(.v-field__outline__start),
.kit-select :deep(.v-field__outline__end) {
  border-color: var(--border-secondary-color, #d9d1c7) !important;
}

.kit-select :deep(.v-field--focused .v-field__outline__start),
.kit-select :deep(.v-field--focused .v-field__outline__end) {
  border-color: var(--border-focus-color, #4b8266) !important;
}
</style>
