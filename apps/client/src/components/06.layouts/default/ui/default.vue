<script lang="ts" setup>

</script>

<template>
  <main class="main-content">
    <slot />
  </main>
</template>

<style scoped lang="scss">
.main-content {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
</style>
