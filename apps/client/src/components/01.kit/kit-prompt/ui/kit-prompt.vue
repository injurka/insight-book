<script setup lang="ts">
import { ref, watch } from 'vue'
import { KitBtn, KitDialog, KitInput } from '~/components/01.kit'

interface Props {
  title?: string
  description?: string
  inputType?: string
  placeholder?: string
  defaultValue?: string | number
  confirmText?: string
  cancelText?: string
  hideInput?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Ввод данных',
  inputType: 'text',
  confirmText: 'ОК',
  cancelText: 'Отмена',
  hideInput: false,
})

const emit = defineEmits<{
  (e: 'submit', value: string): void
  (e: 'cancel'): void
}>()

const visible = defineModel<boolean>('visible', { required: true })
const inputValue = ref<string>('')

watch(visible, (isOpen) => {
  if (isOpen) {
    inputValue.value = props.defaultValue !== undefined ? String(props.defaultValue) : ''
  }
})

function onSubmit() {
  emit('submit', inputValue.value)
  visible.value = false
}

function onCancel() {
  emit('cancel')
  visible.value = false
}
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="title"
    :max-width="360"
    :resizable="false"
  >
    <div class="kit-prompt-body">
      <p v-if="description" class="prompt-desc">
        {{ description }}
      </p>

      <KitInput
        v-if="!hideInput"
        v-model="inputValue"
        :type="inputType"
        :placeholder="placeholder"
        @keyup.enter="onSubmit"
      />
    </div>

    <template #footer>
      <div class="prompt-actions">
        <KitBtn variant="tonal" @click="onCancel">
          {{ cancelText }}
        </KitBtn>
        <KitBtn color="primary" @click="onSubmit">
          {{ confirmText }}
        </KitBtn>
      </div>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
.kit-prompt-body {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .prompt-desc {
    margin: 0;
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
  }
}

.prompt-actions {
  display: flex;
  gap: 8px;
  width: 100%;
  justify-content: flex-end;
}
</style>
