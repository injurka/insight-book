<script setup lang="ts">
import type { CatalogPluginRecord, UploadProgress } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '~/01.shared/composables/use-toast'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'
import { formatBytes } from '../../../lib/formatters'
import { usePluginsStore } from '../../../store/plugins.store'

interface Props {
  plugin?: CatalogPluginRecord | null
}
const props = defineProps<Props>()

const visible = defineModel<boolean>('visible', { required: true })

const { t } = useI18n()
const toast = useToast()
const pluginsStore = usePluginsStore()

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const uploadFile = ref<File | null>(null)
const isDragging = ref(false)
const uploadProgress = ref<UploadProgress | null>(null)

const uploadPercent = computed(() => {
  const progress = uploadProgress.value
  if (!progress || progress.total <= 0)
    return null

  return Math.min(100, Math.floor(progress.loaded / progress.total * 100))
})

const isProcessingUpload = computed(() => uploadPercent.value === 100)

const uploadStatus = computed(() => {
  if (isProcessingUpload.value)
    return t('settings.uploadPluginProcessing')

  if (uploadPercent.value !== null)
    return t('settings.uploadPluginUploading')

  return t('settings.uploadPluginSending', { size: formatBytes(uploadFile.value?.size ?? 0) })
})

watch(visible, (isOpen) => {
  if (isOpen) {
    uploadFile.value = null
    uploadProgress.value = null
    isDragging.value = false
    if (fileInput.value)
      fileInput.value.value = ''
  }
})

function openFilePicker() {
  if (!pluginsStore.isUploadingPlugin)
    fileInput.value?.click()
}

function selectFile(file: File | null) {
  if (!file)
    return

  if (!file.name.toLowerCase().endsWith('.zip')) {
    toast.error(t('settings.uploadPluginInvalidFile'))
    if (fileInput.value)
      fileInput.value.value = ''

    return
  }

  uploadFile.value = file
  uploadProgress.value = null
}

function onUploadFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  selectFile(input.files?.[0] ?? null)
}

function onDragEnter() {
  if (!pluginsStore.isUploadingPlugin)
    isDragging.value = true
}

function onDragLeave(event: DragEvent) {
  const nextTarget = event.relatedTarget
  const currentTarget = event.currentTarget
  if (!(nextTarget instanceof Node) || !(currentTarget instanceof Node) || !currentTarget.contains(nextTarget))
    isDragging.value = false
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  if (pluginsStore.isUploadingPlugin)
    return

  selectFile(event.dataTransfer?.files[0] ?? null)
}

function clearSelectedFile() {
  uploadFile.value = null
  uploadProgress.value = null
  if (fileInput.value)
    fileInput.value.value = ''
}

async function confirmUpload() {
  if (!uploadFile.value) {
    toast.error(t('settings.uploadPluginNoFile', 'Выберите zip-файл плагина'))

    return
  }

  uploadProgress.value = null
  const success = await pluginsStore.uploadPlugin(uploadFile.value, props.plugin?.id, (progress) => {
    uploadProgress.value = progress
  })
  if (success) {
    visible.value = false
    uploadFile.value = null
    uploadProgress.value = null
  }
  else {
    uploadProgress.value = null
  }
}
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="props.plugin ? t('settings.updatePluginTitle') : t('settings.uploadPluginTitle')"
    :max-width="560"
    :persistent="pluginsStore.isUploadingPlugin"
    :closable="!pluginsStore.isUploadingPlugin"
    :minimizable="false"
  >
    <div class="install-dialog-content">
      <p v-if="props.plugin" class="upload-hint">
        <strong>{{ props.plugin.name }} · v{{ props.plugin.version }}</strong><br>
        {{ t('settings.updatePluginHint', { id: props.plugin.id }) }}
      </p>
      <p v-else class="upload-hint">
        {{ t('settings.uploadPluginHint', 'Выберите zip-архив с плагином. После загрузки он будет отправлен на рассмотрение модератором.') }}
      </p>

      <div class="field-group">
        <label for="plugin-archive-input">{{ t('settings.uploadPluginFileLabel', 'Zip-архив плагина:') }}</label>
        <input
          id="plugin-archive-input"
          ref="fileInput"
          type="file"
          accept=".zip,application/zip"
          class="visually-hidden"
          tabindex="-1"
          :disabled="pluginsStore.isUploadingPlugin"
          @change="onUploadFileChange"
        >

        <div
          class="drop-zone"
          :class="{ 'is-dragging': isDragging }"
          @dragenter.prevent="onDragEnter"
          @dragover.prevent="onDragEnter"
          @dragleave.prevent="onDragLeave"
          @drop.prevent="onDrop"
        >
          <button
            type="button"
            class="drop-zone-button"
            :disabled="pluginsStore.isUploadingPlugin"
            @click="openFilePicker"
          >
            <Icon :icon="isDragging ? 'mdi:download' : uploadFile ? 'mdi:folder-refresh-outline' : 'mdi:cloud-upload-outline'" />
            <span class="drop-zone-title">
              {{ isDragging ? t('settings.uploadPluginDropActive') : uploadFile ? t('settings.uploadPluginReplaceFile') : t('settings.uploadPluginChooseFile') }}
            </span>
            <span class="drop-zone-caption">{{ t('settings.uploadPluginDropHint') }}</span>
          </button>
        </div>

        <div v-if="uploadFile" class="file-summary">
          <Icon icon="mdi:archive-check-outline" class="file-icon" />
          <div class="file-details">
            <strong :title="uploadFile.name">{{ uploadFile.name }}</strong>
            <span>{{ formatBytes(uploadFile.size) }}</span>
          </div>
          <KitBtn
            variant="text"
            size="sm"
            :disabled="pluginsStore.isUploadingPlugin"
            @click="clearSelectedFile"
          >
            {{ t('settings.uploadPluginRemoveFile') }}
          </KitBtn>
        </div>

        <div v-if="pluginsStore.isUploadingPlugin" class="upload-status" aria-live="polite">
          <div class="upload-status-heading">
            <span>{{ uploadStatus }}</span>
            <span v-if="uploadPercent !== null && !isProcessingUpload">{{ uploadPercent }}%</span>
          </div>
          <div
            v-if="uploadPercent === null || isProcessingUpload"
            class="upload-progress upload-progress--indeterminate"
            role="progressbar"
            :aria-label="uploadStatus"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span class="upload-progress-indicator" />
          </div>
          <progress
            v-else
            class="upload-progress"
            :value="uploadPercent"
            max="100"
            :aria-label="uploadStatus"
          />
          <span v-if="uploadProgress && !isProcessingUpload" class="upload-progress-detail">
            {{ formatBytes(uploadProgress.loaded) }} / {{ formatBytes(uploadProgress.total) }}
          </span>
        </div>
      </div>

      <div class="dialog-actions">
        <KitBtn
          variant="tonal"
          size="sm"
          :disabled="pluginsStore.isUploadingPlugin"
          @click="visible = false"
        >
          {{ t('common.cancel', 'Отмена') }}
        </KitBtn>
        <KitBtn
          color="primary"
          size="sm"
          :loading="pluginsStore.isUploadingPlugin"
          :disabled="!uploadFile"
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
  gap: 10px;

  > label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--fg-primary-color);
  }
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.drop-zone {
  border: 1px dashed var(--border-secondary-color);
  border-radius: 12px;
  background: var(--bg-secondary-color);
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;

  &:hover,
  &.is-dragging {
    border-color: var(--fg-accent-color);
    background: var(--bg-tertiary-color);
  }

  &.is-dragging {
    border-style: solid;
  }
}

.drop-zone-button {
  width: 100%;
  min-height: 150px;
  padding: 22px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: var(--fg-secondary-color);
  font: inherit;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  > :first-child {
    color: var(--fg-accent-color);
    font-size: 1.8rem;
  }
}

.drop-zone-title {
  color: var(--fg-primary-color);
  font-size: 0.92rem;
  font-weight: 600;
  text-align: center;
}

.drop-zone-caption {
  font-size: 0.82rem;
  text-align: center;
}

.file-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 10px;
  background: var(--bg-secondary-color);

  .file-icon {
    flex-shrink: 0;
    color: var(--fg-accent-color);
    font-size: 1.35rem;
  }
}

.file-details {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  font-size: 0.84rem;

  strong {
    overflow: hidden;
    color: var(--fg-primary-color);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: var(--fg-secondary-color);
  }
}

.upload-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 1px 0;
}

.upload-status-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--fg-primary-color);
  font-size: 0.84rem;
}

.upload-progress {
  width: 100%;
  height: 8px;
  overflow: hidden;
  border: 0;
  border-radius: 999px;
  appearance: none;
  accent-color: var(--fg-accent-color);
  background: var(--bg-tertiary-color);
}

.upload-progress--indeterminate {
  position: relative;
}

.upload-progress-indicator {
  position: absolute;
  inset: 0 auto 0 -35%;
  width: 35%;
  border-radius: inherit;
  background: var(--fg-accent-color);
  animation: plugin-upload-progress 1.6s ease-in-out infinite;
}

@keyframes plugin-upload-progress {
  to {
    transform: translateX(390%);
  }
}

.upload-progress:not(.upload-progress--indeterminate) {
  &::-webkit-progress-bar {
    border-radius: 999px;
    background: var(--bg-tertiary-color);
  }

  &::-webkit-progress-value {
    border-radius: 999px;
    background: var(--fg-accent-color);
    transition: width 0.15s ease;
  }

  &::-moz-progress-bar {
    border-radius: 999px;
    background: var(--fg-accent-color);
  }
}

.upload-progress-detail {
  color: var(--fg-secondary-color);
  font-size: 0.78rem;
  text-align: right;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 4px;
}

@media (max-width: 480px) {
  .file-summary {
    gap: 8px;
    padding: 9px;
  }

  .file-summary :deep(.kit-btn) {
    padding-inline: 8px;
  }
}
</style>
