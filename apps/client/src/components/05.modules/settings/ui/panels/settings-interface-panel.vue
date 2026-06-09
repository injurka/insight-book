<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitSelect } from '~/components/01.kit' // Удалили KitInput за ненадобностью
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { usePushSettings } from '../../composables/use-push-settings'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const {
  pwaStore,
  pushDeckOptions,
  timeOptions,
  pushTargetDeckModel,
  pushTimeStartModel,
  pushTimeEndModel,
  savePushSettings,
  handlePushToggle,
} = usePushSettings()

const appLangOptions = [
  { label: 'Русский', value: 'ru' },
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
]
</script>

<template>
  <h2 class="section-title">
    {{ t('settings.interfaceTitle') }}
  </h2>
  <div class="settings-card lang-card">
    <div class="form-group">
      <label>{{ t('settings.appLanguage') }}</label>
      <KitSelect v-model="settingsStore.appLanguage" :options="appLangOptions" />
    </div>

    <div class="divider" style="margin: 16px 0;" />

    <div class="push-setting-row">
      <div class="push-info">
        <span class="push-title">
          <Icon icon="mdi:bell-ring-outline" class="push-icon" />
          {{ t('settings.pushNotifications') }}
        </span>
        <span class="push-desc">{{ t('settings.pushDesc') }}</span>
      </div>
      <KitBtn
        :variant="pwaStore.isPushSubscribed ? 'tonal' : 'outlined'"
        :color="pwaStore.isPushSubscribed ? 'success' : 'secondary'"
        class="push-btn"
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
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
/* Стили остаются без изменений */
.section-title {
  margin-top: 32px;
  margin-bottom: 16px;
  font-size: 1.4rem;
}
.settings-card {
  background: var(--bg-secondary-color);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  margin-bottom: 16px;
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
.push-setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  .push-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    .push-title {
      font-weight: 500;
      color: var(--fg-primary-color);
      .push-icon {
        vertical-align: text-bottom;
        font-size: 1.1em;
        color: var(--fg-accent-color);
      }
    }
    .push-desc {
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
    }
  }
  .push-btn {
    flex-shrink: 0;
  }
}
.push-details {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--border-secondary-color);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form-row {
  display: flex;
  gap: 16px;
  .flex-1 {
    flex: 1;
  }
}
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
.divider {
  height: 1px;
  background-color: var(--border-secondary-color);
}
</style>
