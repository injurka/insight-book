<script setup lang="ts">
import DialogueTrainerView from '../modules/dialogue-trainer'
</script>

<template>
  <div class="dialogue-page-wrapper">
    <DialogueTrainerView />
  </div>
</template>

<style scoped>
.dialogue-page-wrapper {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
