<script setup lang="ts">
import type { KitSelectOption } from '~/02.kit/molecules/kit-select/ui'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ThemesVariant, useChangeTheme } from '~/01.shared/composables/use-change-theme'
import { useCustomFonts } from '~/01.shared/composables/use-custom-fonts'
import { useTts } from '~/01.shared/composables/use-tts'
import { isTauri } from '~/01.shared/lib/env'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import { KitTooltip } from '~/02.kit/molecules/kit-tooltip/ui'
import { usePushSettings } from '../../composables/use-push-settings'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const { theme } = useChangeTheme()
const { speak, stop, isPlaying, isLoading } = useTts()
const {
  scannedSystemFonts,
  uploadedFonts,
  isScanning,
  isUploading,
  scanSystemFonts,
  uploadFontFile,
  removeUploadedFont,
} = useCustomFonts()

const fontFileInputRef = ref<HTMLInputElement | null>(null)
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

const {
  pwaStore,
  pushDeckOptions,
  timeOptions,
  countOptions,
  pushTargetDeckModel,
  pushTimeStartModel,
  pushTimeEndModel,
  pushCountModel,
  savePushSettings,
  handlePushToggle,
  isPushLoading,
} = usePushSettings()

const appLangOptions = [
  { label: 'Русский', value: 'ru' },
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
]

const themeOptions = computed(() => [
  { label: t('reader.system'), value: ThemesVariant.System },
  { label: t('reader.light'), value: ThemesVariant.Light },
  { label: t('reader.dark'), value: ThemesVariant.Dark },
  { label: t('reader.sepia'), value: ThemesVariant.Sepia },
  { label: t('reader.green'), value: ThemesVariant.Green },
  { label: t('reader.oled'), value: ThemesVariant.Oled },
])

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

const voiceOptions = computed(() => [
  { label: 'Kore (Female)', value: 'Kore' },
  { label: 'Callirrhoe (Female)', value: 'Callirrhoe' },
  { label: 'Leda (Female)', value: 'Leda' },
  { label: 'Orus (Male)', value: 'Orus' },
  { label: 'Puck (Male)', value: 'Puck' },
  { label: 'Charon (Male)', value: 'Charon' },
  { label: 'Fenrir (Male)', value: 'Fenrir' },
])

const speedOptions = [
  { label: '0.75x', value: 0.75 },
  { label: '1.0x', value: 1 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
]

function previewVoice() {
  if (isPlaying.value || isLoading.value)
    stop()

  else
    speak(t('settings.previewVoiceText'), settingsStore.appLanguage || 'en')
}
</script>

<template>
  <div class="settings-interface-panel">
    <h2 class="section-title">
      {{ t('settings.interfaceTitle') }}
    </h2>

    <div class="settings-cards-list">
      <!-- Карта 1: Внешний вид и язык -->
      <div class="settings-card">
        <div class="card-header">
          <Icon icon="mdi:palette-outline" class="card-icon" />
          <h3 class="card-title">
            {{ t('settings.appearanceTitle') }}
          </h3>
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label>{{ t('settings.appLanguage') }}</label>
            <KitSelect v-model="settingsStore.appLanguage" :options="appLangOptions" />
          </div>
          <div class="form-group flex-1">
            <label>{{ t('globalActions.theme') }}</label>
            <KitSelect v-model="theme" :options="themeOptions" />
          </div>
        </div>

        <div class="checkboxes-row">
          <div class="form-group">
            <KitCheckbox v-model="settingsStore.enableHoverRevealBg" :label="t('settings.hoverRevealBg')" />
          </div>
          <div v-if="isTauri" class="form-group">
            <KitCheckbox v-model="settingsStore.enableEruda" :label="t('settings.enableEruda')" />
          </div>
        </div>
      </div>

      <!-- Карта 2: Шрифты и типографика -->
      <div class="settings-card">
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

      <!-- Карта 3: Перевод и озвучка -->
      <div class="settings-card">
        <div class="card-header">
          <Icon icon="mdi:volume-high" class="card-icon" />
          <h3 class="card-title">
            {{ t('reader.translationAndVoice') }}
          </h3>
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label>{{ t('reader.voiceSpeed') }}</label>
            <KitSelect v-model="settingsStore.ttsSpeed" :options="speedOptions" />
          </div>
          <div class="form-group flex-1">
            <label>{{ t('reader.voice') }}</label>
            <div class="voice-select-row">
              <KitSelect v-model="settingsStore.ttsVoice" :options="voiceOptions" class="voice-select" />
              <KitTooltip :text="t('settings.previewVoice')" placement="top">
                <KitBtn
                  :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:stop' : 'mdi:play')"
                  class="preview-btn"
                  :class="{ 'spin-animation': isLoading, 'pulse-animation': isPlaying }"
                  variant="outlined"
                  color="secondary"
                  @click="previewVoice"
                />
              </KitTooltip>
            </div>
          </div>
        </div>
      </div>

      <!-- Карта 4: Push-уведомления -->
      <div class="settings-card">
        <div class="push-setting-row">
          <div class="push-info">
            <div class="card-header no-margin">
              <Icon icon="mdi:bell-ring-outline" class="card-icon" />
              <h3 class="card-title">
                {{ t('settings.pushNotifications') }}
              </h3>
            </div>
            <span class="push-desc">{{ t('settings.pushDesc') }}</span>
          </div>
          <KitBtn
            :variant="pwaStore.isPushSubscribed ? 'tonal' : 'outlined'"
            :color="pwaStore.isPushSubscribed ? 'success' : 'secondary'"
            class="push-btn"
            :disabled="isPushLoading"
            :icon="isPushLoading ? 'mdi:loading' : undefined"
            :class="{ 'is-loading': isPushLoading }"
            @click="handlePushToggle"
          >
            {{ pwaStore.isPushSubscribed ? t('settings.pushActive') : t('settings.pushEnable') }}
          </KitBtn>
        </div>

        <Transition name="fade">
          <div v-if="pwaStore.isPushSubscribed" class="push-details">
            <div class="form-group">
              <label>{{ t('settings.targetDeck') }}</label>
              <KitSelect v-model="pushTargetDeckModel" :options="pushDeckOptions" />
            </div>

            <div class="form-row">
              <div class="form-group flex-1">
                <label>{{ t('settings.pushTimeStart') }}</label>
                <KitSelect v-model="pushTimeStartModel" :options="timeOptions" @update:model-value="savePushSettings" />
              </div>
              <div class="form-group flex-1">
                <label>{{ t('settings.pushTimeEnd') }}</label>
                <KitSelect v-model="pushTimeEndModel" :options="timeOptions" @update:model-value="savePushSettings" />
              </div>
              <div class="form-group flex-1">
                <label>{{ t('settings.pushCount') }}</label>
                <KitSelect v-model="pushCountModel" :options="countOptions" @update:model-value="savePushSettings" />
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-interface-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-title {
  margin-top: 16px;
  margin-bottom: 4px;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--fg-primary-color);
}

.settings-cards-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

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
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;

  &.no-margin {
    margin-bottom: 0;
  }

  .card-icon {
    font-size: 1.4rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
  }

  .card-title {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.form-row {
  display: flex;
  gap: 16px;
  @include media-down(sm) {
    flex-direction: column;
  }
  .flex-1 {
    flex: 1;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  label {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
  }
}

.checkboxes-row {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  align-items: center;
  padding-top: 4px;
}

.font-actions-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  padding-top: 4px;
}

.uploaded-fonts-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sub-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.font-chips-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.font-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 6px;
  font-size: 0.85rem;
  color: var(--fg-primary-color);

  .chip-icon {
    color: var(--fg-accent-color);
  }

  .chip-remove {
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-secondary-color);
    padding: 0;
    margin-left: 4px;
    border-radius: 4px;
    transition: color 0.2s;

    &:hover {
      color: var(--fg-error-color, #ff4d4f);
    }
  }
}

.font-preview-box {
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 10px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .preview-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--fg-muted-color);
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .preview-font-name {
      font-size: 0.8rem;
      font-family: 'Maple Mono CN', monospace;
      color: var(--fg-accent-color);
    }
  }

  .preview-text {
    font-size: 1.05rem;
    color: var(--fg-primary-color);
    line-height: 1.6;
  }
}

.voice-select-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.voice-select {
  flex: 1;
  min-width: 0;
}

.preview-btn {
  padding: 0;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
}

.push-setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;

  .push-info {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .push-desc {
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
    }
  }

  .push-btn {
    flex-shrink: 0;
    &.is-loading {
      :deep(.kit-btn-icon) {
        animation: spin 1s linear infinite;
      }
    }
  }
}

.push-details {
  padding-top: 16px;
  border-top: 1px dashed var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hidden-file-input {
  display: none;
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.spin-animation {
  :deep(svg) {
    animation: spin 1s linear infinite;
  }
}

.pulse-animation {
  :deep(svg) {
    animation: pulse-op 1.2s infinite;
    color: var(--fg-accent-color) !important;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse-op {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
