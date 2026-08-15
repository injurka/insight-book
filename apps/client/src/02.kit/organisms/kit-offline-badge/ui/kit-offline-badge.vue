<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNetworkStore } from '~/01.shared/store/network.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'

const networkStore = useNetworkStore()
const { isForcedOffline, effectiveOffline } = storeToRefs(networkStore)
const { t } = useI18n()

const isDialogOpen = ref(false)

function handleBadgeClick() {
  if (isForcedOffline.value) {
    isDialogOpen.value = true
  }
}

function handleReconnect() {
  networkStore.exitOfflineMode()
  isDialogOpen.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition name="badge-fade">
      <div
        v-if="effectiveOffline"
        class="offline-badge"
        :class="{ 'is-forced': isForcedOffline }"
        role="status"
        :title="t('network.offlineModeActive')"
        @click="handleBadgeClick"
      >
        <Icon
          icon="mdi:wifi-off"
          class="badge-icon"
        />
      </div>
    </Transition>

    <KitDialog
      v-model:visible="isDialogOpen"
      :title="t('network.offlineDialogTitle')"
      icon="mdi:wifi-off"
      :max-width="400"
      :resizable="false"
      :minimizable="false"
      :z-index="2000"
    >
      <div class="dialog-content">
        <p class="dialog-description">
          {{ t('network.offlineDialogDesc') }}
        </p>
      </div>

      <template #footer>
        <KitBtn
          color="primary"
          size="md"
          icon="mdi:refresh"
          class="reconnect-btn"
          @click="handleReconnect"
        >
          {{ t('network.goOnline') }}
        </KitBtn>
      </template>
    </KitDialog>
  </Teleport>
</template>

<style lang="scss" scoped>
.offline-badge {
  position: fixed;
  z-index: var(--z-toast, 1500);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  backdrop-filter: blur(12px);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  bottom: calc(env(safe-area-inset-bottom, 20px) + 20px);
  right: 20px;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 0.82rem;
  font-weight: 600;
  background-color: var(--bg-secondary-color);
  color: var(--fg-secondary-color);
  border: 1px solid var(--border-primary-color);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);

  &.is-forced {
    padding: 12px;
    border-radius: 50%;
    background-color: rgba(234, 179, 8, 0.16);
    color: #eab308;
    border: 1px solid rgba(234, 179, 8, 0.4);
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(234, 179, 8, 0.25);

    &:hover {
      background-color: rgba(234, 179, 8, 0.28);
      transform: scale(1.08);
    }
  }
}

.badge-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.badge-text {
  white-space: nowrap;
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dialog-description {
  font-size: 0.95rem;
  color: var(--fg-secondary-color);
  margin: 0;
  line-height: 1.5;
}

.reconnect-btn {
  width: 100%;
}

.badge-fade-enter-active,
.badge-fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.badge-fade-enter-from,
.badge-fade-leave-to {
  opacity: 0;
  transform: scale(0.85);
}
</style>
