<script setup lang="ts">
import type { PuzzleNode } from '../../model/types'
import { Icon } from '@iconify/vue'
import { useScrollStudyStore } from '../../model/scroll-study.store'
import HexCell from './hex-cell.vue'

const scrollStore = useScrollStudyStore()

function getLinePos(q: number, r: number) {
  const size = scrollStore.hexSize
  const x = size * Math.sqrt(3) * (q + r / 2)
  const y = size * (3 / 2) * r
  return { x, y }
}

function onDrop(event: DragEvent, node: PuzzleNode) {
  const symbol = event.dataTransfer?.getData('text/plain') || scrollStore.selectedTablet
  if (symbol) {
    scrollStore.handleNodeDrop(symbol, node)
  }
}
</script>

<template>
  <div class="research-board-container">
    <!-- Parchment Texture Overlay -->
    <div class="parchment-texture" />
    <div class="vignette-overlay" />

    <template v-if="scrollStore.activeWord">
      <!-- Grid Container -> Origin centered -->
      <div class="grid-center">
        <!-- Connections SVG -->
        <svg class="connections-svg">
          <g transform="translate(0, 0)">
            <line
              v-for="conn in scrollStore.gridConnections"
              :key="conn.id"
              :x1="getLinePos(conn.q1, conn.r1).x"
              :y1="getLinePos(conn.q1, conn.r1).y"
              :x2="getLinePos(conn.q2, conn.r2).x"
              :y2="getLinePos(conn.q2, conn.r2).y"
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
          @click="scrollStore.handleNodeClick"
        />
      </div>

      <!-- Victory Banner Overlay -->
      <Transition name="fade">
        <div v-if="scrollStore.isFinished" class="victory-overlay">
          <div class="victory-card">
            <div class="victory-icon">
              <Icon icon="mdi:script-text-play-outline" />
            </div>
            <h3 class="victory-title">
              Свиток постигнут!
            </h3>
            <div class="victory-char">
              {{ scrollStore.activeTargetChar?.char }}
            </div>
            <p class="victory-desc">
              {{ scrollStore.activeTargetChar?.translation }} [{{ scrollStore.activeTargetChar?.pinyin }}]
            </p>
            <p v-if="scrollStore.activeTargetChar?.etymology" class="victory-etymology">
              "{{ scrollStore.activeTargetChar?.etymology }}"
            </p>
            <button class="next-btn" @click="scrollStore.loadRandomDictionaryScroll">
              <Icon icon="mdi:arrow-right" class="btn-icon" />
              Следующий свиток
            </button>
          </div>
        </div>
      </Transition>
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
</template>

<style lang="scss" scoped>
.research-board-container {
  position: relative;
  width: 620px;
  height: 620px;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  overflow: hidden;
  border-radius: 18px;
  border: 4px solid rgba(120, 53, 15, 0.6);
  background-color: #e4d5b7;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
}

.parchment-texture {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(120, 53, 15, 0.08) 1px, transparent 0);
  background-size: 16px 16px;
  opacity: 0.8;
  pointer-events: none;
  z-index: 0;
}

.vignette-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, transparent 30%, rgba(120, 53, 15, 0.15) 70%, rgba(69, 26, 3, 0.6) 100%);
  pointer-events: none;
  z-index: 0;
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
  stroke: #f59e0b;
  stroke-width: 5px;
  stroke-linecap: round;
  filter: drop-shadow(0 0 6px #f59e0b);
  animation: pulse-line 1.5s infinite alternate;
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
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  &:active {
    transform: scale(0.96);
  }
}

.victory-overlay {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
}

.victory-card {
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(245, 158, 11, 0.5);
  border-radius: 16px;
  padding: 20px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(245, 158, 11, 0.25);
  max-width: 380px;

  .victory-icon {
    font-size: 2rem;
    color: #f59e0b;
    margin-bottom: 4px;
  }

  .victory-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #fbbf24;
  }

  .victory-char {
    font-size: 3rem;
    color: #fffbeb;
    margin: 4px 0;
    text-shadow: 0 0 12px rgba(245, 158, 11, 0.8);
  }

  .victory-desc {
    margin: 0 0 8px;
    font-size: 0.9rem;
    color: #cbd5e1;
    font-weight: 500;
  }

  .victory-etymology {
    margin: 0 0 16px;
    font-size: 0.775rem;
    color: #94a3b8;
    font-style: italic;
  }

  .next-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    background: linear-gradient(180deg, rgba(245, 158, 11, 0.3) 0%, rgba(217, 119, 6, 0.4) 100%);
    border: 1px solid rgba(245, 158, 11, 0.6);
    color: #fef3c7;
    border-radius: 10px;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(245, 158, 11, 0.5);
      border-color: #fbbf24;
      transform: scale(1.02);
    }

    &:active {
      transform: scale(0.96);
    }

    .btn-icon {
      font-size: 1.1rem;
    }
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse-line {
  0% {
    stroke-width: 4px;
    opacity: 0.7;
  }
  100% {
    stroke-width: 6px;
    opacity: 1;
    filter: drop-shadow(0 0 10px #f59e0b);
  }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
