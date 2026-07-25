<script lang="ts" setup>
import { AppTitlebar } from '~/components/02.shared/app-titlebar'
</script>

<template>
  <div class="layout-root">
    <AppTitlebar />
    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
.layout-root {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  width: 100vw;
  overflow: hidden;
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  position: relative;
  overflow-y: auto;

  > * {
    min-height: min-content;
  }
}
</style>
