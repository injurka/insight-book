<script setup lang="ts">
import { useId } from 'vue'
import sidebarFrameUrl from '../../../../assets/sidebar/pixel-wood-frame.webp'

const frameId = useId().replace(/:/g, '-')
const corners = [
  { name: 'top-left', crop: '0 0 200 200' },
  { name: 'top-right', crop: '1054 0 200 200' },
  { name: 'bottom-left', crop: '0 1054 200 200' },
  { name: 'bottom-right', crop: '1054 1054 200 200' },
]
const rails = [
  { name: 'top', crop: '200 0 160 160' },
  { name: 'right', crop: '1094 200 160 160' },
  { name: 'bottom', crop: '200 1094 160 160' },
  { name: 'left', crop: '0 200 160 160' },
]
const ornaments = [
  { name: 'top', crop: '400 0 454 160' },
  { name: 'bottom', crop: '400 1094 454 160' },
  { name: 'left', crop: '0 540 160 160' },
  { name: 'right', crop: '1094 540 160 160' },
]
</script>

<template>
  <div class="game-panel-frame" aria-hidden="true">
    <svg v-for="corner in corners" :key="corner.name" class="corner" :class="corner.name" :viewBox="corner.crop">
      <image :href="sidebarFrameUrl" width="1254" height="1254" />
    </svg>
    <svg v-for="rail in rails" :key="rail.name" class="rail" :class="rail.name">
      <defs>
        <pattern :id="`${frameId}-${rail.name}`" patternUnits="userSpaceOnUse" width="40" height="40">
          <svg class="rail-tile" width="40" height="40" :viewBox="rail.crop">
            <image :href="sidebarFrameUrl" width="1254" height="1254" />
          </svg>
        </pattern>
      </defs>
      <rect width="100%" height="100%" :fill="`url(#${frameId}-${rail.name})`" />
    </svg>
    <svg v-for="ornament in ornaments" :key="ornament.name" class="ornament" :class="ornament.name" :viewBox="ornament.crop">
      <image :href="sidebarFrameUrl" width="1254" height="1254" />
    </svg>
  </div>
</template>

<style scoped lang="scss">
.game-panel-frame {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr) 50px;
  grid-template-rows: 50px minmax(0, 1fr) 50px;
  pointer-events: none;
  z-index: 2;
  image-rendering: pixelated;
}

svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.rail-tile {
  width: 40px;
  height: 40px;
}

.top-left { grid-area: 1 / 1; }
.top-right { grid-area: 1 / 3; }
.bottom-left { grid-area: 3 / 1; }
.bottom-right { grid-area: 3 / 3; }
.rail.top { grid-area: 1 / 2; height: 40px; align-self: start; }
.rail.right { grid-area: 2 / 3; width: 40px; justify-self: end; }
.rail.bottom { grid-area: 3 / 2; height: 40px; align-self: end; }
.rail.left { grid-area: 2 / 1; width: 40px; justify-self: start; }

.ornament {
  position: absolute;
  width: 40px;
  height: 40px;

  &.top, &.bottom {
    width: 113.5px;
    left: 50%;
    transform: translateX(-50%);
  }
  &.top { top: 0; }
  &.bottom { bottom: 0; }
  &.left, &.right {
    top: 50%;
    transform: translateY(-50%);
  }
  &.left { left: 0; }
  &.right { right: 0; }
}
</style>
