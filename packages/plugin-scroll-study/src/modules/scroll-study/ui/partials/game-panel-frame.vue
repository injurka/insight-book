<template>
  <div class="game-panel-frame" aria-hidden="true" />
</template>

<style scoped>
.game-panel-frame {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  border: var(--panel-corner, 50px) solid transparent;
  border-image: url('../../../../assets/sidebar/pixel-wood-frame.webp') 200 / var(--panel-corner, 50px) / 0 stretch;
  pointer-events: none;
  z-index: 2;
  image-rendering: pixelated;
}
</style>
