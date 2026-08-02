<script setup lang="ts">
import type { PuzzleNode } from '../../model/types'
import { computed, ref } from 'vue'
import { useScrollStudyStore } from '../../model/scroll-study.store'
import EnergyCoreCanvas from './energy-core-canvas.vue'

const props = defineProps<{
  node: PuzzleNode
  hexSize: number
  isFinished: boolean
  isSelectedTarget: boolean
}>()

const emit = defineEmits<{
  (e: 'click', node: PuzzleNode): void
  (e: 'drop', event: DragEvent, node: PuzzleNode): void
}>()

const scrollStore = useScrollStudyStore()
const isDragOver = ref(false)

const q = props.node.q
const r = props.node.r

const width = computed(() => props.hexSize * Math.sqrt(3))
const height = computed(() => props.hexSize * 2)

const xOffset = computed(() => props.hexSize * Math.sqrt(3) * (q + r / 2))
const yOffset = computed(() => props.hexSize * (3 / 2) * r)

function getCharFontSize(symbol?: string) {
  if (!symbol)
    return '1.6rem'
  if (symbol.length === 2)
    return '1.2rem'
  if (symbol.length >= 3)
    return '0.85rem'
  return '1.6rem'
}

function handleDrop(event: DragEvent) {
  isDragOver.value = false
  emit('drop', event, props.node)
}

function handleDragOver(event: DragEvent) {
  if (props.node.type === 'empty' && !props.isFinished) {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
    isDragOver.value = true
  }
}

function handleDragLeave() {
  isDragOver.value = false
}
</script>

<template>
  <div
    class="hex-cell"
    :data-node-id="node.id"
    :class="[
      `cell-${node.type}`,
      {
        'filled': !!node.character && node.character !== '?',
        'finished-cell': isFinished && node.type === 'target',
        'interactive': node.type === 'empty' && !isFinished,
        'selected-target': isSelectedTarget && node.type === 'empty' && !isFinished,
        'drag-over-cell': (isDragOver || scrollStore.hoveredNodeId === node.id) && node.type === 'empty' && !isFinished,
      },
    ]"
    :style="{
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(calc(${xOffset}px - 50%), calc(${yOffset}px - 50%))`,
    }"
    @dragover="handleDragOver"
    @dragenter.prevent="isDragOver = true"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
    @click="emit('click', node)"
  >
    <div class="hex-cell-inner">
      <div v-if="node.character !== '?' && node.type !== 'target'" class="aura-dot" />

      <EnergyCoreCanvas v-if="node.character === '?'" />

      <span
        v-else-if="node.character"
        class="hex-char"
        :style="{ fontSize: getCharFontSize(node.character) }"
      >
        {{ node.character }}
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hex-cell {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease, filter 0.3s ease;
  z-index: 10;
  user-select: none;

  &.interactive {
    cursor: pointer;

    &:hover {
      transform: scale(1.1);
      z-index: 20;
    }
  }
}

.hex-cell-inner {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.aura-dot {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  transition: all 0.3s ease;
}

.hex-char {
  position: relative;
  z-index: 10;
  text-align: center;
  line-height: 1;
  transition: all 0.2s ease;
  display: block;
  user-select: none;
  pointer-events: none;
}

/* Empty cell styles */
.cell-empty {
  .aura-dot {
    width: 14px;
    height: 14px;
    background: rgba(74, 60, 49, 0.4);
    box-shadow: 0 0 8px rgba(74, 60, 49, 0.3);
    border: 1px solid rgba(74, 60, 49, 0.5);
  }

  &.interactive:hover .aura-dot {
    transform: scale(1.8);
    background: rgba(224, 159, 62, 0.6);
    box-shadow: 0 0 15px rgba(224, 159, 62, 0.8);
    border-color: rgba(224, 159, 62, 0.9);
  }

  &.filled {
    .aura-dot {
      width: 42px;
      height: 42px;
      background: radial-gradient(circle, rgba(74, 60, 49, 0.3) 0%, rgba(74, 60, 49, 0.05) 70%);
      border: 1px solid rgba(74, 60, 49, 0.5);
    }

    &.interactive:hover .aura-dot {
      background: radial-gradient(circle, rgba(224, 159, 62, 0.4) 0%, rgba(224, 159, 62, 0.1) 70%);
      border-color: rgba(224, 159, 62, 0.7);
    }

    .hex-char {
      color: #fbbf24;
      text-shadow: 0 0 8px rgba(251, 191, 36, 0.6);
    }
  }
}

.drag-over-cell .aura-dot {
  transform: scale(2.2) !important;
  background: rgba(245, 158, 11, 0.8) !important;
  box-shadow: 0 0 25px rgba(245, 158, 11, 0.9) !important;
  border-color: #fbbf24 !important;
}

/* Anchor cell styles */
.cell-anchor {
  .aura-dot {
    width: 48px;
    height: 48px;
    background: radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.05) 70%);
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
    border: 1px solid rgba(239, 68, 68, 0.6);
  }

  .hex-char {
    color: #fca5a5;
    font-weight: bold;
    text-shadow: 0 0 10px rgba(239, 68, 68, 0.8);
  }
}

/* Target cell styles */
.cell-target {
  .aura-dot {
    width: 60px;
    height: 60px;
    background: radial-gradient(circle, rgba(224, 159, 62, 0.25) 0%, rgba(224, 159, 62, 0.05) 60%, rgba(140, 115, 90, 0) 80%);
    border: 1.5px dashed rgba(224, 159, 62, 0.5);
    animation: target-aura-pulse 3s infinite ease-in-out;
  }

  .hex-char {
    color: rgba(255, 255, 255, 0.6);
    animation: target-text-pulse 2s infinite alternate;
  }
}

/* Energy Center Effect (replaces question mark) */
.energy-center {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;

  .energy-core {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: radial-gradient(circle, #fffbeb 0%, #fbbf24 45%, #d97706 80%, rgba(217, 119, 6, 0) 100%);
    box-shadow:
      0 0 12px #fbbf24,
      0 0 24px rgba(245, 158, 11, 0.8),
      inset 0 0 6px #ffffff;
    animation: energy-core-breath 2s infinite ease-in-out;
    z-index: 5;
  }

  .energy-ring {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;

    &.ring-1 {
      width: 32px;
      height: 32px;
      border: 1.5px dashed rgba(251, 191, 36, 0.7);
      animation: energy-spin-cw 8s linear infinite;
      box-shadow: 0 0 10px rgba(251, 191, 36, 0.3);
    }

    &.ring-2 {
      width: 46px;
      height: 46px;
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-top-color: rgba(251, 191, 36, 0.85);
      border-bottom-color: rgba(251, 191, 36, 0.85);
      animation: energy-spin-ccw 5s linear infinite, energy-pulse-scale 3s ease-in-out infinite;
    }
  }

  .energy-particles {
    position: absolute;
    width: 40px;
    height: 40px;
    animation: energy-spin-cw 6s linear infinite;

    .particle {
      position: absolute;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #fbbf24;
      box-shadow: 0 0 6px #f59e0b;

      &.p1 {
        top: 0;
        left: 50%;
        transform: translateX(-50%);
      }
      &.p2 {
        bottom: 4px;
        left: 6px;
      }
      &.p3 {
        bottom: 4px;
        right: 6px;
      }
    }
  }
}

.finished-cell {
  .aura-dot {
    width: 80px;
    height: 80px;
    background: radial-gradient(circle, rgba(251, 191, 36, 0.5) 0%, rgba(251, 191, 36, 0.1) 70%) !important;
    border: 2px solid #f59e0b !important;
    box-shadow:
      0 0 30px rgba(251, 191, 36, 0.8),
      inset 0 0 15px rgba(251, 191, 36, 0.4) !important;
    animation: final-aura-pulse 2.5s infinite alternate !important;
  }

  .hex-char {
    color: #fffbeb !important;
    font-weight: 700;
    text-shadow: 0 0 15px #f59e0b !important;
    animation: none !important;
  }
}

@keyframes energy-core-breath {
  0%, 100% {
    transform: scale(0.85);
    box-shadow:
      0 0 10px #fbbf24,
      0 0 20px rgba(245, 158, 11, 0.6),
      inset 0 0 4px #ffffff;
  }
  50% {
    transform: scale(1.15);
    box-shadow:
      0 0 16px #fef08a,
      0 0 32px rgba(245, 158, 11, 1),
      inset 0 0 8px #ffffff;
  }
}

@keyframes energy-spin-cw {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes energy-spin-ccw {
  from {
    transform: rotate(360deg);
  }
  to {
    transform: rotate(0deg);
  }
}

@keyframes energy-pulse-scale {
  0%, 100% {
    transform: scale(0.95);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.08);
    opacity: 1;
  }
}

@keyframes target-aura-pulse {
  0%, 100% {
    transform: scale(0.95);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
    box-shadow: 0 0 18px rgba(224, 159, 62, 0.4);
  }
}

@keyframes target-text-pulse {
  0% {
    opacity: 0.5;
    transform: scale(0.95);
  }
  100% {
    opacity: 0.9;
    transform: scale(1.05);
  }
}

@keyframes final-aura-pulse {
  0% {
    transform: scale(1);
    filter: drop-shadow(0 0 10px #f59e0b);
  }
  100% {
    transform: scale(1.1);
    filter: drop-shadow(0 0 25px #f59e0b);
  }
}
</style>
