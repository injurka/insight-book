<script setup lang="ts">
export interface Props {
  modelValue?: string | number | null
  type?: string
  placeholder?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  placeholder: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onUpdate(val: string) {
  emit('update:modelValue', val)
}
</script>

<template>
  <v-text-field
    :model-value="props.modelValue ?? ''"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    density="compact"
    variant="outlined"
    hide-details="auto"
    class="kit-input"
    v-bind="$attrs"
    @update:model-value="onUpdate"
  />
</template>

<style scoped>
.kit-input :deep(.v-field) {
  background-color: var(--bg-primary-color, #f3efe9) !important;
  border-radius: 6px !important;
  font-size: 14px;
  color: var(--fg-primary-color, #4a443c) !important;
}

.kit-input :deep(.v-field__outline__start),
.kit-input :deep(.v-field__outline__end) {
  border-color: var(--border-secondary-color, #d9d1c7) !important;
}

.kit-input :deep(.v-field--focused .v-field__outline__start),
.kit-input :deep(.v-field--focused .v-field__outline__end) {
  border-color: var(--border-focus-color, #4b8266) !important;
}
</style>
