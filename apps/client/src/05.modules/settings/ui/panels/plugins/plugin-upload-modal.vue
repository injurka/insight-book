<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '~/01.shared/composables/use-toast'
import { KitBtn, KitDialog } from '~/02.kit'
import { usePluginsStore } from '../../../store/plugins.store'

const visible = defineModel<boolean>('visible', { required: true })

const { t } = useI18n()
const toast = useToast()
const pluginsStore = usePluginsStore()

const uploadFile = ref<File | null>(null)

watch(visible, (isOpen) => {
  if (isOpen)
    uploadFile.value = null
})

function onUploadFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  uploadFile.value = input.files?.[0] ?? null
}

async function confirmUpload() {
  if (!uploadFile.value) {
    toast.error(t('settings.uploadPluginNoFile', 'Выберите zip-файл плагина'))
    return
  }

  const success = await pluginsStore.uploadPlugin(uploadFile.value)
  if (success) {
    visible.value = false
    uploadFile.value = null
  }
}
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="t('settings.uploadPluginTitle', 'Загрузка своего плагина')"
    :max-width="540"
  >
    <div class="install-dialog-content">
      <p class="upload-hint">
        {{ t('settings.uploadPluginHint', 'Выберите zip-архив с плагином. После загрузки он будет отправлен на рассмотрение модератором.') }}
      </p>

      <div class="field-group">
        <label>{{ t('settings.uploadPluginFileLabel', 'Zip-архив плагина:') }}</label>
        <input
          type="file"
          accept=".zip"
          class="file-input"
          @change="onUploadFileChange"
        >
      </div>

      <div class="dialog-actions">
        <KitBtn variant="tonal" size="sm" @click="visible = false">
          {{ t('common.cancel', 'Отмена') }}
        </KitBtn>
        <KitBtn
          color="primary"
          size="sm"
          :loading="pluginsStore.isUploadingPlugin"
          @click="confirmUpload"
        >
          {{ t('settings.uploadConfirm', 'Отправить на рассмотрение') }}
        </KitBtn>
      </div>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.install-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.upload-hint {
  margin: 0;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  line-height: 1.4;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--fg-primary-color);
  }
}

.file-input {
  font-size: 0.9rem;
  color: var(--fg-primary-color);

  &::file-selector-button {
    margin-right: 12px;
    padding: 6px 14px;
    border: none;
    border-radius: 8px;
    background: var(--bg-tertiary-color);
    color: var(--fg-primary-color);
    cursor: pointer;
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}
</style>
