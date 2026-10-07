<script setup lang="ts">
import type { GridConnection, PuzzleNode } from '../../model/types'
import { Icon } from '@iconify/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { formatPinyin } from '../../lib/format-pinyin'
import { playUiSound } from '../../lib/ui-sound'
import { useScrollStudyStore } from '../../model/scroll-study.store'
import HexCell from './hex-cell.vue'

interface Props {
  selectOnClick: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ requestSymbol: [node: PuzzleNode] }>()

const scrollStore = useScrollStudyStore()
const viewportRef = ref<HTMLDivElement | null>(null)
const boardWidth = 620
const boardHeight = boardWidth
const boardScale = ref(1)
const boardStyle = computed(() => ({ transform: `scale(${boardScale.value})` }))
let resizeObserver: ResizeObserver | undefined

function updateBoardScale() {
  const viewport = viewportRef.value
  if (!viewport)
    return

  const { width, height } = viewport.getBoundingClientRect()
  boardScale.value = Math.max(0, Math.min(width / boardWidth, height / boardHeight, 1))
}

onMounted(() => {
  resizeObserver = new ResizeObserver(updateBoardScale)
  if (viewportRef.value)
    resizeObserver.observe(viewportRef.value)
  updateBoardScale()
})

onUnmounted(() => resizeObserver?.disconnect())

function getLinePos(q: number, r: number) {
  const size = scrollStore.hexSize
  const x = size * Math.sqrt(3) * (q + r / 2)
  const y = size * (3 / 2) * r

  return { x, y }
}

function getConnectionPos(conn: GridConnection) {
  const start = getLinePos(conn.q1, conn.r1)
  const end = getLinePos(conn.q2, conn.r2)
  const dx = end.x - start.x
  const dy = end.y - start.y
  // Stop at the square tile edge, with a small gap around its border.
  const inset = scrollStore.hexSize * 0.62 / Math.max(Math.abs(dx), Math.abs(dy))

  return {
    x1: start.x + dx * inset,
    y1: start.y + dy * inset,
    x2: end.x - dx * inset,
    y2: end.y - dy * inset,
  }
}

function onDrop(event: DragEvent, node: PuzzleNode) {
  const symbol = event.dataTransfer?.getData('text/plain') || scrollStore.selectedTablet
  if (symbol) {
    const action = scrollStore.handleNodeDrop(symbol, node)
    if (action)
      playUiSound(action)
  }
}

function onNodeClick(node: PuzzleNode) {
  if (props.selectOnClick && !node.character && !scrollStore.isFinished) {
    emit('requestSymbol', node)

    return
  }

  const action = scrollStore.handleNodeClick(node)
  if (action)
    playUiSound(action)
}
</script>

<template>
  <div class="board-viewport">
    <div ref="viewportRef" class="board-stage">
      <div class="research-board-container" :style="boardStyle">
        <div class="research-board-frame" aria-hidden="true" />

        <template v-if="scrollStore.activeWord">
          <!-- Grid Container -> Origin centered -->
          <div class="grid-center">
            <!-- Connections SVG -->
            <svg class="connections-svg">
              <g transform="translate(0, 0)">
                <line
                  v-for="conn in scrollStore.gridConnections"
                  :key="conn.id"
                  :x1="getConnectionPos(conn).x1"
                  :y1="getConnectionPos(conn).y1"
                  :x2="getConnectionPos(conn).x2"
                  :y2="getConnectionPos(conn).y2"
                  class="connection-line"
                />
              </g>
            </svg>

            <!-- Hex Cells -->
            <HexCell
              v-for="node in scrollStore.activeGrid"
              :key="node.id"
              :node="node"
              :hex-size="scrollStore.hexSize"
              :is-finished="scrollStore.isFinished"
              :is-selected-target="!!scrollStore.selectedTablet"
              @drop="onDrop"
              @click="onNodeClick"
            />
          </div>
        </template>

        <div v-else class="empty-state">
          <div class="yin-yang-icon">
            <Icon icon="mdi:yin-yang" />
          </div>
          <h2 class="empty-title">
            Магический стол пустует
          </h2>
          <p class="empty-subtitle">
            Нажмите "Развернуть свиток" чтобы открыть сетку и начать исследование тайных символов.
          </p>
          <button class="start-btn" @click="scrollStore.initGrid">
            Развернуть свиток
          </button>
        </div>
      </div>
    </div>

    <Transition name="victory">
      <section
        v-if="scrollStore.isFinished"
        class="victory-panel"
        aria-live="polite"
      >
        <div class="victory-card">
          <div class="victory-seal" aria-hidden="true">
            <Icon icon="mdi:check" />
          </div>
          <div class="victory-copy">
            <div class="victory-heading">
              <span class="victory-title">Свиток постигнут</span>
              <span class="victory-char">{{ scrollStore.activeTargetChar?.char }}</span>
              <span class="victory-desc">
                {{ scrollStore.activeTargetChar?.translation }}
                <span class="victory-pinyin">[{{ formatPinyin(scrollStore.activeTargetChar?.pinyin ?? '') }}]</span>
              </span>
            </div>
            <p v-if="scrollStore.activeTargetChar?.etymology" class="victory-etymology">
              {{ scrollStore.activeTargetChar?.etymology }}
            </p>
          </div>
          <button class="next-btn" @click="scrollStore.loadRandomDictionaryScroll()">
            Следующий свиток
            <Icon icon="mdi:arrow-right" class="btn-icon" />
          </button>
        </div>
      </section>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.board-viewport {
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.board-stage {
  box-sizing: border-box;
  flex: 1;
  width: 100%;
  min-height: 0;
  position: relative;
  overflow: clip;
}

.research-board-container {
  position: absolute;
  left: 50%;
  top: 50%;
  margin-left: -310px;
  margin-top: -310px;
  transform-origin: center;
  flex-shrink: 0;
  width: 620px;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  isolation: isolate;

  &::before {
    content: '';
    position: absolute;
    z-index: -1;
    pointer-events: none;
    inset: 4%;
    background: #efdbaf url('../../../../assets/research-board/parchment.webp') center / cover no-repeat;
    filter: drop-shadow(0 10px 14px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 22px rgba(0, 0, 0, 0.3));
  }
}

@container scroll-study (min-width: 901px) {
  .research-board-container {
    user-select: none;
  }
}

.research-board-frame {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: url('../../../../assets/research-board/frame.webp') center / contain no-repeat;
  /* Balance the atlas's 10px top and 41px bottom transparent margins. */
  transform: translateY(1.24%);
  image-rendering: pixelated;
}

.grid-center {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  z-index: 10;
}

.connections-svg {
  position: absolute;
  inset: 0;
  overflow: visible;
  pointer-events: none;
  z-index: 0;
  width: 1px;
  height: 1px;
}

.connection-line {
  stroke: #a66b2d;
  stroke-width: 3px;
  stroke-linecap: round;
  opacity: 0.85;
}

.empty-state {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  max-width: 360px;
  padding: 0 16px;
  color: rgba(69, 26, 3, 0.9);
}

.yin-yang-icon {
  font-size: 4rem;
  opacity: 0.35;
  margin-bottom: 16px;
  animation: spin 24s linear infinite;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 8px;
  color: #451a03;
}

.empty-subtitle {
  font-size: 0.875rem;
  line-height: 1.5;
  color: rgba(69, 26, 3, 0.8);
  margin: 0 0 24px;
}

.start-btn {
  padding: 12px 32px;
  background: linear-gradient(180deg, #b45309 0%, #78350f 100%);
  color: #fef3c7;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.95rem;
  border: 1px solid #d97706;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: linear-gradient(180deg, #d97706 0%, #92400e 100%);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  &:active {
    transform: scale(0.96);
  }
}

.victory-panel {
  flex: 0 1 auto;
  min-height: 0;
  max-height: 35%;
  overflow-y: auto;
  overscroll-behavior: contain;
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 0 12px;
  box-sizing: border-box;
}

.victory-card {
  width: min(520px, 100%);
  min-width: 0;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  color: #4b2d18;
  background:
    linear-gradient(rgba(255, 248, 229, 0.3), rgba(132, 81, 39, 0.06)),
    url('../../../../assets/research-board/parchment.webp') center / cover no-repeat;
  border: 1px solid rgba(91, 55, 29, 0.62);
  border-left: 3px solid #935b32;
  border-radius: 3px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.24);

  .victory-seal {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    box-sizing: border-box;
    border: 1px solid rgba(111, 66, 34, 0.45);
    border-radius: 50%;
    color: #80502d;
    background: rgba(255, 245, 219, 0.48);
    font-size: 1rem;
  }

  .victory-copy {
    min-width: 0;
  }

  .victory-heading {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 2px 8px;
    min-width: 0;
  }

  .victory-title {
    color: #795331;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .victory-char {
    color: #652f1c;
    font-size: 1.3rem;
    font-weight: 700;
    line-height: 1;
  }

  .victory-desc {
    min-width: 0;
    color: #513a27;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .victory-pinyin {
    margin-left: 3px;
    white-space: nowrap;
    color: #745b40;
    font-weight: 500;
  }

  .victory-etymology {
    margin: 2px 0 0;
    color: #765b3f;
    font-size: 0.68rem;
    font-style: italic;
    line-height: 1.25;
  }

  .next-btn {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 11px;
    background: rgba(103, 59, 32, 0.94);
    border: 1px solid #56331e;
    color: #f8ebcd;
    border-radius: 2px;
    font-weight: 600;
    font-size: 0.72rem;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background: #80502d;
    }

    &:active {
      transform: scale(0.96);
    }

    .btn-icon {
      font-size: 0.9rem;
    }
  }
}

@container scroll-study (max-width: 600px) {
  .victory-card {
    grid-template-columns: 28px minmax(0, 1fr);
    gap: 8px;
    padding: 9px 11px;

    .next-btn {
      grid-column: 2;
      justify-self: start;
    }
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.victory-enter-active,
.victory-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.victory-enter-from,
.victory-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
