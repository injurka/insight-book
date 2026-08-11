<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { isTauri as isTauriApp } from '~/01.shared/lib/env'
import { usePwaStore } from '~/01.shared/store/pwa.store'
import KitBtn from '~/02.kit/atoms/kit-btn/ui/kit-btn.vue'

const pwaStore = usePwaStore()
const { t } = useI18n()

const { offlineReady, needRefresh } = storeToRefs(pwaStore)
</script>

<template>
  <Teleport to="body">
    <Transition name="prompt-slide">
      <div
        v-if="offlineReady || needRefresh"
        class="reload-prompt"
        role="alert"
      >
        <div class="prompt-main">
          <div class="prompt-icon-container" :class="{ 'is-ready': offlineReady }">
            <Icon :icon="offlineReady ? 'mdi:check-circle-outline' : 'mdi:cloud-download-outline'" />
          </div>
          <div class="prompt-content">
            <div class="prompt-title">
              {{ offlineReady ? t('pwa.offlineReadyTitle') : t('pwa.updateAvailableTitle') }}
            </div>
            <div class="prompt-description">
              {{ offlineReady ? t('pwa.offlineReadyDesc') : isTauriApp ? t('pwa.tauriUpdateAvailableDesc') : t('pwa.updateAvailableDesc') }}
            </div>
          </div>
          <button class="prompt-close-btn" aria-label="Close" @click="pwaStore.closePrompt()">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div v-if="needRefresh" class="prompt-actions">
          <KitBtn
            class="action-btn"
            size="md"
            color="primary"
            icon="mdi:refresh"
            @click="pwaStore.triggerUpdate()"
          >
            {{ isTauriApp ? t('pwa.tauriUpdateBtn') : t('pwa.updateBtn') }}
          </KitBtn>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.reload-prompt {
  position: fixed;
  right: var(--p-l, 20px);
  bottom: var(--p-l, 20px);
  z-index: var(--z-pwa-prompt, 1600);
  background-color: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 16px;
  box-shadow: 0 12px 36px -8px var(--bg-overlay-primary-color);
  width: 380px;
  max-width: calc(100vw - 32px);
  backdrop-filter: blur(12px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  @include media-down(sm) {
    right: 16px;
    left: 16px;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 20px);
    width: auto;
    padding: 16px;
    border-radius: 20px;
    gap: 14px;
  }
}

.prompt-main {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.prompt-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-accent-color);
  font-size: 1.5rem;
  flex-shrink: 0;

  &.is-ready {
    color: var(--fg-success-color);
  }
}

.prompt-content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 2px;
}

.prompt-title {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.prompt-description {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  line-height: 1.4;
}

.prompt-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--fg-tertiary-color);
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-top: -2px;
  margin-right: -4px;

  &:hover {
    background-color: var(--bg-tertiary-color);
    color: var(--fg-primary-color);
  }
}

.prompt-actions {
  display: flex;
  padding-left: 54px;

  @include media-down(sm) {
    padding-left: 0;
  }

  .action-btn {
    width: 100%;
  }
}

.prompt-slide-enter-active,
.prompt-slide-leave-active {
  transition:
    opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.prompt-slide-enter-from,
.prompt-slide-leave-to {
  opacity: 0;
  transform: translateY(24px) scale(0.95);
}
</style>
