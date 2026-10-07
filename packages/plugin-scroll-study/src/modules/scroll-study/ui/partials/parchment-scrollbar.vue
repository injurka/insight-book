<script setup lang="ts">
import SimpleBar from 'simplebar'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import 'simplebar/dist/simplebar.css'

const emit = defineEmits<{
  (e: 'ready', element: HTMLElement | null): void
  (e: 'scroll', event: Event): void
}>()

const rootRef = ref<HTMLElement | null>(null)
let scrollbar: SimpleBar | undefined
let scrollElement: HTMLElement | null = null

function onScroll(event: Event) {
  emit('scroll', event)
}

onMounted(() => {
  if (!rootRef.value)
    return
  scrollbar = new SimpleBar(rootRef.value, { autoHide: false, scrollbarMinSize: 56 })
  scrollElement = scrollbar.getScrollElement()
  scrollElement?.addEventListener('scroll', onScroll, { passive: true })
  emit('ready', scrollElement)
})

onBeforeUnmount(() => {
  scrollElement?.removeEventListener('scroll', onScroll)
  scrollbar?.unMount()
  emit('ready', null)
})
</script>

<template>
  <div ref="rootRef" class="parchment-scrollbar">
    <div class="parchment-scrollbar-content">
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.parchment-scrollbar {
  position: relative;
  min-height: 0;
  min-width: 0;

  :deep(.simplebar-content-wrapper) {
    overscroll-behavior: contain;
    touch-action: pan-y;
    overflow-anchor: none;
  }

  :deep(.simplebar-track.simplebar-vertical) {
    width: 14px;
    top: 3px;
    bottom: 8px;
    border-radius: 999px;

    &::before {
      content: '';
      position: absolute;
      inset: 0 6px;
      border-radius: inherit;
      background: #69422126;
      pointer-events: none;
    }
  }

  :deep(.simplebar-track.simplebar-vertical .simplebar-scrollbar::before) {
    top: 2px;
    bottom: 2px;
    left: 4px;
    right: 4px;
    border-radius: 999px;
    background: #80512e;
    box-shadow: inset 0 0 0 1px #efd9b033;
    opacity: 1;
    transition: background-color 0.15s ease, box-shadow 0.15s ease;
  }

  :deep(.simplebar-track.simplebar-vertical:hover .simplebar-scrollbar::before) {
    background: #694221;
    box-shadow: inset 0 0 0 1px #efd9b04d, 0 0 4px #48250f26;
  }

  &.simplebar-dragging :deep(.simplebar-track.simplebar-vertical .simplebar-scrollbar::before) {
    background: #48250f;
  }
}

@media (prefers-reduced-motion: reduce) {
  .parchment-scrollbar :deep(.simplebar-track.simplebar-vertical .simplebar-scrollbar::before) {
    transition: none;
  }
}
</style>
