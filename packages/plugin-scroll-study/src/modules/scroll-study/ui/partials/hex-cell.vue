<script setup lang="ts">
import type { PuzzleNode } from '../../model/types'
import { computed, ref, useTemplateRef } from 'vue'
import { useScrollStudyStore } from '../../model/scroll-study.store'
import AnchorInfoPopover from './anchor-info-popover.vue'

interface Props {
  node: PuzzleNode
  hexSize: number
  isFinished: boolean
  isSelectedTarget: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'click', node: PuzzleNode): void
  (e: 'drop', event: DragEvent, node: PuzzleNode): void
}>()

const scrollStore = useScrollStudyStore()
const infoPopover = useTemplateRef<InstanceType<typeof AnchorInfoPopover>>('infoPopover')

const isDragOver = ref(false)
const isInfoOpen = ref(false)
const q = props.node.q
const r = props.node.r

const isInteractive = computed(() => props.node.type === 'anchor' || (props.node.type === 'empty' && !props.isFinished))
const width = computed(() => props.hexSize * Math.sqrt(3))
const height = computed(() => props.hexSize * 2)
const xOffset = computed(() => props.hexSize * Math.sqrt(3) * (q + r / 2))
const yOffset = computed(() => props.hexSize * (3 / 2) * r)

function handleClick(event: MouseEvent | KeyboardEvent) {
  if (props.node.type === 'anchor' && event.currentTarget instanceof HTMLElement) {
    infoPopover.value?.toggle(event.currentTarget)

    return
  }

  if (isInteractive.value)
    emit('click', props.node)
}
function getCharFontSize(symbol?: string) {
  if (!symbol)
    return `${props.hexSize * 0.76}px`

  if (symbol.length === 2)
    return `${props.hexSize * 0.52}px`

  if (symbol.length >= 3)
    return `${props.hexSize * 0.36}px`

  return `${props.hexSize * 0.76}px`
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
        'filled': !!node.character,
        'finished-cell': isFinished && (node.type === 'anchor' || !!node.character),
        'interactive': isInteractive,
        'info-open': isInfoOpen,
        'selected-target': isSelectedTarget && node.type === 'empty' && !isFinished,
        'drag-over-cell': (isDragOver || scrollStore.hoveredNodeId === node.id) && node.type === 'empty' && !isFinished,
      },
    ]"
    :style="{
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(calc(${xOffset}px - 50%), calc(${yOffset}px - 50%))`,
    }"
    :role="isInteractive ? 'button' : undefined"
    :tabindex="isInteractive ? 0 : undefined"
    :aria-label="node.type === 'anchor' ? `О символе ${node.character}` : node.character || 'Пустая ячейка'"
    :aria-expanded="node.type === 'anchor' ? isInfoOpen : undefined"
    :aria-haspopup="node.type === 'anchor' ? 'dialog' : undefined"
    :aria-controls="node.type === 'anchor' ? infoPopover?.id : undefined"
    @dragover="handleDragOver"
    @dragenter.prevent="isDragOver = true"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
    @keydown.enter.self.prevent="handleClick"
    @keydown.space.self.prevent="handleClick"
    @click="handleClick"
  >
    <AnchorInfoPopover
      v-if="node.type === 'anchor'"
      ref="infoPopover"
      :node="node"
      @open-change="isInfoOpen = $event"
    />
    <div class="hex-cell-inner">
      <div class="cell-surface" />

      <Transition name="placement">
        <span
          v-if="node.character"
          :key="node.character"
          class="hex-char"
          :style="{ fontSize: getCharFontSize(node.character) }"
        >
          {{ node.character }}
        </span>
      </Transition>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hex-cell {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  outline: none;

  &.interactive {
    cursor: pointer;
  }
}

@container scroll-study (min-width: 901px) {
  .hex-cell {
    user-select: none;
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

.cell-surface {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: #c6ae89;
  border: 1px solid #a38b6a;
  pointer-events: none;
  transition:
    width 0.16s ease-out,
    height 0.16s ease-out,
    border-radius 0.16s ease-out,
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.16s ease-out;
}

.hex-char {
  position: relative;
  color: #382719;
  font-family: 'Maple Mono CN', monospace;
  font-weight: 500;
  text-align: center;
  line-height: 1.15;
  pointer-events: none;
}

.filled .cell-surface {
  width: 66%;
  height: 57%;
  border-radius: 7px;
  background: #fff5df;
  border-color: #bba078;
  box-shadow: 0 2px 4px rgba(69, 38, 12, 0.16);
}

.cell-anchor {
  .cell-surface {
    background: #f6e0c4;
    border-color: #a75c36;
    box-shadow:
      0 2px 4px rgba(69, 38, 12, 0.18),
      inset 0 3px #a75c36;
  }

  .hex-char {
    color: #74351e;
    font-weight: 600;
  }
}

.info-open .cell-surface,
.interactive:hover .cell-surface,
.hex-cell:focus-visible .cell-surface,
.selected-target:not(.filled) .cell-surface {
  background: #ffe6b6;
  border-color: #a66b2d;
  box-shadow: 0 0 0 3px rgba(166, 107, 45, 0.15);
}

.drag-over-cell .cell-surface {
  width: 66%;
  height: 57%;
  border-radius: 7px;
  background: #ffe6b6;
  border-color: #8e541e;
  box-shadow: 0 2px 7px rgba(69, 38, 12, 0.2);
  transform: scale(1.03);
}

.finished-cell {
  .cell-surface {
    background: #f0edd2;
    border-color: #7d8545;
    box-shadow:
      0 2px 4px rgba(69, 38, 12, 0.16),
      inset 0 3px #7d8545;
  }

  .hex-char {
    color: #414a24;
  }
}
.placement-enter-active {
  animation: glyph-stamp 480ms cubic-bezier(0.22, 1, 0.36, 1);
}

.cell-empty .hex-cell-inner:has(.placement-enter-active) .cell-surface {
  animation: placement-pulse 480ms ease-out;
}

@keyframes glyph-stamp {
  0% {
    opacity: 0;
    transform: translateY(-8px) scale(1.3);
  }
  45% {
    opacity: 1;
    transform: translateY(1px) scale(0.94);
  }
  75% {
    transform: translateY(0) scale(1.04);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes placement-pulse {
  0% {
    box-shadow: 0 0 0 0 #b8824580;
    background: #ffe6b6;
  }
  55% {
    box-shadow: 0 0 0 9px #b8824520;
  }
  100% {
    box-shadow: 0 0 0 15px #b8824500;
  }
}
</style>
