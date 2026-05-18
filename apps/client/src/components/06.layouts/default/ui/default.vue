<script lang="ts" setup>

</script>

<template>
  <main class="main-content">
    <slot />
  </main>
</template>

<style scoped lang="scss">
.main-content {
  height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
