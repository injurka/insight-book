<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { KitPageLoader } from '~/02.kit/atoms/kit-page-loader/ui'

interface Props {
  show: boolean
}

defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="reader-loading-wrapper">
      <div class="spinner-box">
        <KitPageLoader />
      </div>
      <h3 class="loading-text">
        {{ t('reader.preparingPageTitle') }}
      </h3>
      <p class="loading-subtext">
        {{ t('reader.preparingPageDesc') }}
      </p>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.reader-loading-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  pointer-events: none;
  width: calc(100% - 32px);
  max-width: 400px;
  padding: 24px;
  background: rgba(var(--bg-primary-color-rgb, 13, 17, 23), 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 16px;

  .spinner-box {
    height: 60px;
    margin-bottom: 16px;
    :deep(.page-loader) {
      min-height: unset;
    }
  }

  .loading-text {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0 0 8px 0;
  }

  .loading-subtext {
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    margin: 0;
  }
}
</style>
