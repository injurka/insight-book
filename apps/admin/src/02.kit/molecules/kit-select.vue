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

.kit-select :deep(.v-field__outline__start),
.kit-select :deep(.v-field__outline__end) {
  border-color: var(--border-secondary-color, #d9d1c7) !important;
}

.kit-select :deep(.v-field--focused .v-field__outline__start),
.kit-select :deep(.v-field--focused .v-field__outline__end) {
  border-color: var(--border-focus-color, #4b8266) !important;
}
</style>
