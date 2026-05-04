<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn } from '~/components/01.kit'
import { usePwaStore } from '~/shared/store/pwa.store'

const pwaStore = usePwaStore()

const { offlineReady, needRefresh } = storeToRefs(pwaStore)
</script>

<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div
        v-if="offlineReady || needRefresh"
        class="reload-prompt"
        role="alert"
      >
        <div class="prompt-icon">
          <Icon icon="mdi:download-circle-outline" />
        </div>
        <div class="prompt-content-wrapper">
          <div class="prompt-message">
            <h4 class="prompt-title">
              <span v-if="offlineReady">Готово к оффлайн-работе</span>
              <span v-else>Доступно обновление</span>
            </h4>
            <p class="prompt-description">
              <span v-if="offlineReady">
                Приложение было успешно кэшировано и теперь доступно без подключения к сети.
              </span>
              <span v-else>
                Новая версия приложения загружена. Нажмите "Обновить", чтобы применить изменения.
              </span>
            </p>
          </div>
          <div class="prompt-actions">
            <KitBtn
              v-if="needRefresh"
              icon="mdi:refresh"
              color="primary"
              @click="pwaStore.triggerUpdate()"
            >
              Обновить
            </KitBtn>
            <KitBtn
              variant="outlined"
              color="secondary"
              @click="pwaStore.closePrompt()"
            >
              Закрыть
            </KitBtn>
          </div>
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
  display: flex;
  align-items: flex-start;
  gap: var(--p-m, 16px);
  padding: 16px;
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  z-index: 10000;
  background-color: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  box-shadow: 0 8px 32px var(--bg-overlay-primary-color);
  max-width: 480px;
  backdrop-filter: blur(8px);

  @include media-down(sm) {
    flex-direction: column;
    right: var(--p-s, 12px);
    left: var(--p-s, 12px);
    bottom: var(--p-s, 12px);
    max-width: calc(100% - 24px);
  }
}

.prompt-icon {
  font-size: 2rem;
  color: var(--fg-accent-color);
  flex-shrink: 0;
  margin-top: 2px;
}

.prompt-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--p-s, 12px);
  flex-grow: 1;
  width: 100%;
}

.prompt-message {
  flex-grow: 1;
}

.prompt-title {
  margin: 0 0 4px 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.prompt-description {
  margin: 0;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  line-height: 1.5;
}

.prompt-actions {
  display: flex;
  gap: var(--p-xs, 8px);
  align-self: flex-end;

  @include media-down(xs) {
    width: 100%;
    flex-direction: column;
    align-self: stretch;

    .kit-btn {
      width: 100%;
    }
  }
}
</style>
