<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitSelect } from '~/02.kit/molecules/kit-select/ui'
import { usePushSettings } from '../../../composables/use-push-settings'

const { t } = useI18n()

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
</script>

<template>
  <div class="settings-card push-settings-card">
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

  &.no-margin {
    margin: 0;
  }

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

.push-setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;

  @include media-down(sm) {
    flex-direction: column;
    align-items: flex-start;
  }

  .push-info {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .push-desc {
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
      line-height: 1.4;
    }
  }

  .push-btn {
    flex-shrink: 0;
  }
}

.push-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--border-secondary-color);
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

.form-row {
  display: flex;
  gap: 20px;

  @include media-down(sm) {
    flex-direction: column;
    gap: 16px;
  }
}
</style>
