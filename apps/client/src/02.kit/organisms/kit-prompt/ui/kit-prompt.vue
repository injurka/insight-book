<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog, KitInput } from '~/02.kit'

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
  inputType: 'text',
  hideInput: false,
})

const emit = defineEmits<{
  (e: 'submit', value: string): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()

const visible = defineModel<boolean>('visible', { required: true })
const inputValue = ref<string>('')

watch(visible, (isOpen) => {
  if (isOpen)
    inputValue.value = props.defaultValue !== undefined ? String(props.defaultValue) : ''
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
    :title="title || t('kit.prompt.title')"
    :max-width="360"
    :resizable="false"
    :minimizable="false"
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
          {{ cancelText || t('kit.prompt.cancel') }}
        </KitBtn>
        <KitBtn color="primary" @click="onSubmit">
          {{ confirmText || t('kit.prompt.confirm') }}
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
