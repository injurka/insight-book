<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { KitActivityLoader } from '~/02.kit/molecules/kit-activity-loader/ui'

interface Props {
  show: boolean
}

defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <Transition name="fade">
    <div v-if="show" class="reader-loading-wrapper">
      <KitActivityLoader
        class="reader-loading-content"
        icon="mdi:book-open-page-variant-outline"
        :title="t('reader.preparingPageTitle')"
        :description="t('reader.preparingPageDesc')"
      />
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
  pointer-events: none;
  width: calc(100% - 32px);
  max-width: 400px;
  background: rgba(var(--bg-primary-color-rgb, 13, 17, 23), 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 16px;

  > .reader-loading-content {
    padding: 12px 16px 0;
  }
}
</style>
