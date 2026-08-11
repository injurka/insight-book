<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useNetworkStore } from '~/01.shared/store/network.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'

const networkStore = useNetworkStore()
const { isTimeoutModalOpen } = storeToRefs(networkStore)
const { t } = useI18n()

function handleWorkOffline() {
  networkStore.enterOfflineMode()
}

function handleRetry() {
  networkStore.retryRequest()
}
</script>

<template>
  <KitDialog
    v-model:visible="isTimeoutModalOpen"
    :title="t('network.timeoutTitle')"
    icon="mdi:wifi-strength-1-alert"
    :max-width="440"
    :persistent="true"
    :resizable="false"
    :minimizable="false"
    :z-index="2000"
  >
    <div class="card-content">
      <p class="card-description">
        {{ t('network.timeoutDesc') }}
      </p>
    </div>

    <template #footer>
      <div class="card-actions">
        <KitBtn
          color="primary"
          size="lg"
          icon="mdi:wifi-off"
          class="action-btn"
          @click="handleWorkOffline"
        >
          {{ t('network.workOfflineBtn') }}
        </KitBtn>

        <KitBtn
          color="secondary"
          size="md"
          icon="mdi:refresh"
          class="action-btn"
          @click="handleRetry"
        >
          {{ t('network.retryBtn') }}
        </KitBtn>
      </div>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
.card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-description {
  font-size: 0.95rem;
  color: var(--fg-secondary-color);
  margin: 0;
  line-height: 1.5;
}

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;

  .action-btn {
    width: 100%;
  }
}
</style>
