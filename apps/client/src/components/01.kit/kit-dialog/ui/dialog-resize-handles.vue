<script setup lang="ts">
const emit = defineEmits<{
  (e: 'resize', handle: string, event: MouseEvent): void
}>()
</script>

<template>
  <div class="resize-handle top" @mousedown.prevent="emit('resize', 'top', $event)" />
  <div class="resize-handle right" @mousedown.prevent="emit('resize', 'right', $event)" />
  <div class="resize-handle bottom" @mousedown.prevent="emit('resize', 'bottom', $event)" />
  <div class="resize-handle left" @mousedown.prevent="emit('resize', 'left', $event)" />

  <div class="resize-handle top-left" @mousedown.prevent="emit('resize', 'top-left', $event)" />
  <div class="resize-handle top-right" @mousedown.prevent="emit('resize', 'top-right', $event)" />
  <div class="resize-handle bottom-left" @mousedown.prevent="emit('resize', 'bottom-left', $event)" />
  <div class="resize-handle bottom-right" @mousedown.prevent="emit('resize', 'bottom-right', $event)" />
</template>

<style lang="scss" scoped>
.resize-handle {
  position: absolute;
  z-index: 100;

  &.top {
    top: -6px;
    left: 6px;
    right: 6px;
    height: 12px;
    cursor: n-resize;
  }
  &.bottom {
    bottom: -6px;
    left: 6px;
    right: 6px;
    height: 12px;
    cursor: s-resize;
  }
  &.left {
    top: 6px;
    bottom: 6px;
    left: -6px;
    width: 12px;
    cursor: e-resize;
  }
  &.right {
    top: 6px;
    bottom: 6px;
    right: -6px;
    width: 12px;
    cursor: w-resize;
  }
  &.top-left {
    top: -6px;
    left: -6px;
    width: 16px;
    height: 16px;
    cursor: nw-resize;
  }
  &.top-right {
    top: -6px;
    right: -6px;
    width: 16px;
    height: 16px;
    cursor: ne-resize;
  }
  &.bottom-left {
    bottom: -6px;
    left: -6px;
    width: 16px;
    height: 16px;
    cursor: sw-resize;
  }
  &.bottom-right {
    bottom: -6px;
    right: -6px;
    width: 16px;
    height: 16px;
    cursor: se-resize;
  }
}

@include media-down(sm) {
  .resize-handle {
    display: none !important;
  }
}
</style>
