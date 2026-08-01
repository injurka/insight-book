<script setup lang="ts">
import type { PuzzleNode } from '../../model/types'
import { computed, ref } from 'vue'
import { useScrollStudyStore } from '../../model/scroll-study.store'

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
      <div class="aura-dot" />

      <span
        v-if="node.character"
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
    background: radial-gradient(circle, rgba(140, 115, 90, 0.2) 0%, rgba(140, 115, 90, 0) 80%);
    border: 2px dashed rgba(74, 60, 49, 0.5);
    animation: target-aura-pulse 3s infinite ease-in-out;
  }

  .hex-char {
    color: rgba(255, 255, 255, 0.6);
    animation: target-text-pulse 2s infinite alternate;
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

@keyframes target-aura-pulse {
  0%, 100% {
    transform: scale(0.95);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
    box-shadow: 0 0 15px rgba(140, 115, 90, 0.3);
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
