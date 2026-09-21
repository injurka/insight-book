<script setup lang="ts">
import type { KitSelectOption } from '~/02.kit/molecules/kit-select/ui'
import { Icon } from '@iconify/vue'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCustomFonts } from '~/01.shared/composables/use-custom-fonts'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()

const {
  scannedSystemFonts,
  uploadedFonts,
  isScanning,
  isUploading,
  scanSystemFonts,
  uploadFontFile,
  removeUploadedFont,
} = useCustomFonts()

const fontFileInputRef = useTemplateRef<HTMLInputElement>('fontFileInputRef')
const isFontPreviewOpen = ref(false)

function triggerFontUpload() {
  fontFileInputRef.value?.click()
}

async function handleFontFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const familyName = await uploadFontFile(file)
    if (familyName) {
      settingsStore.appFontFamily = `'${familyName}', sans-serif`
    }
  }

  target.value = ''
}

function handleDeleteFontOption(opt: KitSelectOption) {
  const family = opt.meta?.family
  if (typeof family === 'string') {
    removeUploadedFont(family)
    if (settingsStore.appFontFamily === `'${family}', sans-serif`) {
      settingsStore.appFontFamily = '\'Maple Mono CN\', monospace'
    }

    if (settingsStore.readerFontFamily === `'${family}', sans-serif`) {
      settingsStore.readerFontFamily = '\'Maple Mono CN\', \'Microsoft YaHei\', sans-serif'
    }
  }
}

const baseFontOptions = computed<KitSelectOption[]>(() => {
  const hasSystem = scannedSystemFonts.value.length > 0
  const hasUploaded = uploadedFonts.value.length > 0
  const enableGroups = hasSystem || hasUploaded

  const appGroup = enableGroups ? t('settings.fontGroupApp') : undefined
  const uploadedGroup = enableGroups ? t('settings.fontGroupUploaded') : undefined
  const systemGroup = enableGroups ? t('settings.fontGroupSystem') : undefined

  const list: KitSelectOption[] = [
    { label: t('settings.fontMapleMono'), value: '\'Maple Mono CN\', monospace', group: appGroup },
    { label: t('settings.fontSystem'), value: 'system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif', group: appGroup },
    { label: t('settings.fontSerif'), value: 'Georgia, \'Times New Roman\', serif', group: appGroup },
    { label: t('settings.fontMonospace'), value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', group: appGroup },
  ]

  for (const f of uploadedFonts.value) {
    list.push({
      label: f.name,
      value: `'${f.family}', sans-serif`,
      group: uploadedGroup,
      deletable: true,
      meta: { family: f.family },
    })
  }

  for (const family of scannedSystemFonts.value) {
    list.push({
      label: family,
      value: `'${family}', sans-serif`,
      group: systemGroup,
    })
  }

  list.push({
    label: t('settings.fontCustom'),
    value: 'custom',
    group: appGroup,
  })

  return list
})

const appFontOptions = computed(() => baseFontOptions.value)
const readerFontOptions = computed<KitSelectOption[]>(() => {
  const hasSystem = scannedSystemFonts.value.length > 0
  const hasUploaded = uploadedFonts.value.length > 0
  const enableGroups = hasSystem || hasUploaded
  const appGroup = enableGroups ? t('settings.fontGroupApp') : undefined

  return [
    { label: t('reader.fontDefault'), value: '\'Maple Mono CN\', \'Microsoft YaHei\', sans-serif', group: appGroup },
    ...baseFontOptions.value.filter(opt => opt.value !== '\'Maple Mono CN\', monospace'),
  ]
})
</script>

<template>
  <div class="settings-card typography-card">
    <div class="card-header">
      <Icon icon="mdi:format-font" class="card-icon" />
      <h3 class="card-title">
        {{ t('settings.fontManagementTitle') }}
      </h3>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label>{{ t('settings.appFont') }}</label>
        <KitSelect
          v-model="settingsStore.appFontFamily"
          :options="appFontOptions"
          @delete="handleDeleteFontOption"
        />
      </div>
      <div class="form-group flex-1">
        <label>{{ t('settings.readerFont') }}</label>
        <KitSelect
          v-model="settingsStore.readerFontFamily"
          :options="readerFontOptions"
          @delete="handleDeleteFontOption"
        />
      </div>
    </div>

    <Transition name="fade">
      <div v-if="settingsStore.appFontFamily === 'custom'" class="form-group">
        <label>{{ t('settings.fontCustom') }}</label>
        <KitInput
          v-model="settingsStore.appFontCustom"
          :placeholder="t('settings.customFontPlaceholder')"
          clearable
        />
      </div>
    </Transition>

    <div class="font-actions-row">
      <KitBtn
        variant="tonal"
        color="secondary"
        size="sm"
        :disabled="isUploading"
        :icon="isUploading ? 'mdi:loading' : 'mdi:upload'"
        @click="triggerFontUpload"
      >
        {{ t('settings.uploadFontFile') }}
      </KitBtn>

      <KitBtn
        variant="tonal"
        color="secondary"
        size="sm"
        :disabled="isScanning"
        :icon="isScanning ? 'mdi:loading' : 'mdi:cellphone-link'"
        @click="scanSystemFonts"
      >
        {{ t('settings.scanSystemFonts') }}
      </KitBtn>

      <KitBtn
        :variant="isFontPreviewOpen ? 'tonal' : 'outlined'"
        color="secondary"
        size="sm"
        :icon="isFontPreviewOpen ? 'mdi:eye-off-outline' : 'mdi:eye-outline'"
        @click="isFontPreviewOpen = !isFontPreviewOpen"
      >
        {{ t('settings.fontPreviewTitle') }}
      </KitBtn>

      <input
        ref="fontFileInputRef"
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        class="hidden-file-input"
        @change="handleFontFileChange"
      >
    </div>

    <div v-if="uploadedFonts.length > 0" class="uploaded-fonts-section">
      <span class="sub-label">{{ t('settings.uploadedFontsList') }}</span>
      <div class="font-chips-list">
        <div v-for="f in uploadedFonts" :key="f.family" class="font-chip">
          <Icon icon="mdi:format-font" class="chip-icon" />
          <span class="chip-name">{{ f.name }}</span>
          <button class="chip-remove" title="Remove font" @click="removeUploadedFont(f.family)">
            <Icon icon="mdi:close" />
          </button>
        </div>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="isFontPreviewOpen" class="font-preview-box">
        <div class="preview-header">
          <span class="preview-title">{{ t('settings.fontPreviewTitle') }}</span>
          <span class="preview-font-name">{{ settingsStore.effectiveAppFont }}</span>
        </div>
        <div class="preview-text" :style="{ fontFamily: settingsStore.effectiveAppFont }">
          Съешь ещё этих мягких французских булок, да выпей чаю. The quick brown fox jumps over the lazy dog. 敏捷的棕色狐狸跳过懒狗。 1234567890 !@#$%^&*()_+-=[]{}|;:',.&lt;&gt;?/
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.settings-card {
  background: var(--bg-secondary-color);
  padding: 24px;
  border-radius: 14px;
  border: 1px solid var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  gap: 20px;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;

  .card-icon {
    font-size: 1.5rem;
    color: var(--fg-accent-color);
  }

  .card-title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.form-row {
  display: flex;
  gap: 20px;

  @include media-down(sm) {
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;

    label {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--fg-secondary-color);
    }

    &.flex-1 {
      flex: 1;
      min-width: 0;
    }
  }
}

.font-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;

  .hidden-file-input {
    display: none;
  }
}

.uploaded-fonts-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-secondary-color);

  .sub-label {
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
    font-weight: 500;
  }

  .font-chips-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .font-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: var(--bg-tertiary-color);
      border: 1px solid var(--border-secondary-color);
      border-radius: 6px;
      font-size: 0.85rem;
      color: var(--fg-primary-color);

      .chip-icon {
        font-size: 1rem;
        color: var(--fg-secondary-color);
      }

      .chip-remove {
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        padding: 0;
        cursor: pointer;
        color: var(--fg-secondary-color);
        font-size: 0.9rem;

        &:hover {
          color: var(--fg-error-color);
        }
      }
    }
  }
}

.font-preview-box {
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .preview-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
    border-bottom: 1px solid var(--border-secondary-color);
    padding-bottom: 6px;
  }

  .preview-text {
    font-size: 1.1rem;
    line-height: 1.6;
    color: var(--fg-primary-color);
    word-break: break-word;
  }
}
</style>
