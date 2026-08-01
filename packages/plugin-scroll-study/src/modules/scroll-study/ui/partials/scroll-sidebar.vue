<script setup lang="ts">
import type { CharacterData } from '../../../../data'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { allCharacters } from '../../../../data'
import { useScrollStudyStore } from '../../model/scroll-study.store'

interface MysteryScrollData {
  id: string
  char: string
  targetCharacterId: string
  title: string
  translation: string
  pinyin: string
  difficulty: 'Легкий' | 'Средний' | 'Сложный' | 'Легендарный'
  hintText: string
}

const mysteryScrolls: MysteryScrollData[] = []

defineProps<{
  isOpen: boolean
  activeTab: 'symbols' | 'scrolls'
}>()

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void
  (e: 'update:activeTab', value: 'symbols' | 'scrolls'): void
  (e: 'pointerdown-symbol', event: PointerEvent, item: CharacterData): void
}>()

const scrollStore = useScrollStudyStore()

const selectedTierFilter = ref<number | 'all'>('all')
const searchQuery = ref('')
const hoveredChar = ref<CharacterData | null>(null)

const filteredCharacters = computed(() => {
  return allCharacters.filter((item) => {
    if (selectedTierFilter.value !== 'all' && item.tier !== selectedTierFilter.value) {
      return false
    }

    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      const matchesChar = item.char.includes(q)
      const matchesPinyin = item.pinyin.toLowerCase().includes(q)
      const matchesTrans = item.translation.toLowerCase().includes(q)
      return matchesChar || matchesPinyin || matchesTrans
    }

    return true
  })
})

const selectedCharObj = computed(() => {
  return allCharacters.find(c => c.char === scrollStore.selectedTablet) || null
})

function selectScroll(scroll: MysteryScrollData) {
  const charObj = allCharacters.find(c => c.char === scroll.char || c.id === scroll.targetCharacterId)
  if (charObj) {
    scrollStore.loadCharacterScroll(charObj)
    emit('update:activeTab', 'symbols')
  }
}

function getDifficultyBadgeClass(difficulty: MysteryScrollData['difficulty']) {
  switch (difficulty) {
    case 'Легкий':
      return 'badge-easy'
    case 'Средний':
      return 'badge-medium'
    case 'Сложный':
      return 'badge-hard'
    case 'Легендарный':
      return 'badge-legendary'
    default:
      return 'badge-default'
  }
}
</script>

<template>
  <div class="sidebar-wrapper">
    <!-- Semi-transparent Unfolding Panel -->
    <Transition name="ink-slide">
      <div v-if="isOpen" class="sidebar-panel">
        <!-- Top Glow Line -->
        <div class="glow-top-bar" />

        <!-- TAB 1: ALL SYMBOLS -->
        <div v-if="activeTab === 'symbols'" class="tab-content">
          <!-- Search & Filter Controls -->
          <div class="filter-controls">
            <div class="search-box">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Поиск по знаку, пиньин..."
                class="search-input"
              >
              <Icon icon="mdi:magnify" class="search-icon" />
              <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">
                <Icon icon="mdi:close" />
              </button>
            </div>

            <!-- Tier Pills -->
            <div class="tier-pills">
              <button
                class="tier-pill"
                :class="{ active: selectedTierFilter === 'all' }"
                @click="selectedTierFilter = 'all'"
              >
                Все ({{ allCharacters.length }})
              </button>
              <button
                class="tier-pill"
                :class="{ active: selectedTierFilter === 0 }"
                @click="selectedTierFilter = 0"
              >
                Радикалы
              </button>
              <button
                class="tier-pill"
                :class="{ active: selectedTierFilter === 1 }"
                @click="selectedTierFilter = 1"
              >
                Простые
              </button>
              <button
                class="tier-pill"
                :class="{ active: selectedTierFilter === 2 }"
                @click="selectedTierFilter = 2"
              >
                Сложные
              </button>
            </div>
          </div>

          <!-- Symbols Grid -->
          <div class="symbols-grid custom-scrollbar">
            <button
              v-for="item in filteredCharacters"
              :key="item.id"
              class="symbol-card"
              :class="{ selected: scrollStore.selectedTablet === item.char }"
              @click="scrollStore.selectedTablet = item.char"
              @pointerdown="emit('pointerdown-symbol', $event, item)"
              @mouseenter="hoveredChar = item"
              @mouseleave="hoveredChar = null"
            >
              <span class="char-symbol">{{ item.char }}</span>
              <span class="char-pinyin">{{ item.pinyin }}</span>
              <div class="card-hover-overlay" />
            </button>
          </div>

          <!-- Bottom Info Box -->
          <div class="info-box">
            <template v-if="hoveredChar || selectedCharObj">
              <div class="info-header">
                <span class="info-char">
                  {{ (hoveredChar || selectedCharObj)?.char }}
                </span>
                <div class="info-meta">
                  <div class="info-trans">
                    {{ (hoveredChar || selectedCharObj)?.translation }}
                    <span class="info-pinyin">
                      [{{ (hoveredChar || selectedCharObj)?.pinyin }}]
                    </span>
                  </div>
                  <div class="info-sub">
                    Тьер {{ (hoveredChar || selectedCharObj)?.tier }} • Черты: {{ (hoveredChar || selectedCharObj)?.strokeCount }}
                  </div>
                </div>
              </div>
              <p class="info-etymology">
                {{ (hoveredChar || selectedCharObj)?.etymology }}
              </p>
            </template>
            <template v-else>
              <p class="info-placeholder">
                Выберите иероглиф из таблицы выше и кликните по пустой ячейке на пергаменте, чтобы нанести его.
              </p>
            </template>
          </div>
        </div>

        <!-- TAB 2: SCROLLS SELECTION -->
        <div v-else-if="activeTab === 'scrolls'" class="tab-content">
          <p class="scrolls-desc">
            Выберите древний свиток для постижения тайных связей знаков.
          </p>

          <div class="scrolls-list custom-scrollbar">
            <div
              v-for="scroll in mysteryScrolls"
              :key="scroll.id"
              class="scroll-card"
              :class="{ active: scrollStore.activeTargetChar?.char === scroll.char }"
            >
              <div class="scroll-card-header">
                <div class="scroll-info">
                  <div class="scroll-char-box">
                    {{ scroll.char }}
                  </div>
                  <div>
                    <h3 class="scroll-title">
                      {{ scroll.title }}
                      <span
                        v-if="scrollStore.completedScrollIds.includes(scroll.id)"
                        class="check-icon"
                        title="Постигнуто"
                      >✓</span>
                    </h3>
                    <div class="scroll-target">
                      Цель: <span class="highlight">{{ scroll.translation }}</span> [{{ scroll.pinyin }}]
                    </div>
                  </div>
                </div>

                <span class="difficulty-badge" :class="getDifficultyBadgeClass(scroll.difficulty)">
                  {{ scroll.difficulty }}
                </span>
              </div>

              <p class="scroll-hint">
                "{{ scroll.hintText }}"
              </p>

              <div class="scroll-card-footer">
                <button class="select-scroll-btn" @click="selectScroll(scroll)">
                  <Icon icon="mdi:play" class="play-icon" />
                  {{ scrollStore.activeTargetChar?.char === scroll.char ? 'Текущий' : 'Развернуть' }}
                </button>
              </div>
            </div>
          </div>
        </div>


      </div>
    </Transition>

    <!-- Attached Toggle Button -->
    <button
      class="toggle-btn"
      :class="{ 'is-open': isOpen }"
      :title="isOpen ? 'Свернуть панель' : 'Открыть меню знаков и свитков'"
      @click="emit('update:isOpen', !isOpen)"
    >
      <Icon :icon="isOpen ? 'mdi:close' : 'mdi:script-text-outline'" class="toggle-icon" />
      <div class="glow-bg" />
    </button>
  </div>
</template>

<style lang="scss" scoped>
.sidebar-wrapper {
  position: relative;
  z-index: 20;
}

.sidebar-panel {
  position: absolute;
  top: 24px;
  left: 24px;
  width: 380px;
  height: calc(100% - 84px);
  border: 1px solid rgba(245, 158, 11, 0.3);
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.85) 0%, rgba(2, 6, 23, 0.9) 100%);
  backdrop-filter: blur(16px);
  display: flex;
  flex-direction: column;
  padding: 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
  border-radius: 20px;
  overflow: hidden;
}

.glow-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.7), transparent);
}


.tabs-container {
  display: flex;
  gap: 6px;
  background: rgba(15, 23, 42, 0.7);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid rgba(51, 65, 85, 0.5);
}

.tab-btn {
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
  color: #94a3b8;
  background: transparent;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    color: #f1f5f9;
    background: rgba(30, 41, 59, 0.5);
  }

  &.active {
    background: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
    border-color: rgba(245, 158, 11, 0.4);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .tab-icon {
    font-size: 1.1rem;
  }

  .count-pill {
    font-size: 0.65rem;
    padding: 2px 6px;
    border-radius: 10px;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }
}

.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.filter-controls {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-box {
  position: relative;
  display: flex;

  .search-input {
    width: 100%;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(51, 65, 85, 0.7);
    border-radius: 10px;
    padding: 7px 12px 7px 34px;
    font-size: 0.75rem;
    color: #e2e8f0;

    &::placeholder {
      color: #64748b;
    }

    &:focus {
      outline: none;
      border-color: rgba(245, 158, 11, 0.6);
    }
  }

  .search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #64748b;
    font-size: 1rem;
    pointer-events: none;
  }

  .clear-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;

    &:hover {
      color: #e2e8f0;
    }
  }
}

.tier-pills {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;

  .tier-pill {
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 0.7rem;
    border: 1px solid rgba(51, 65, 85, 0.6);
    background: rgba(15, 23, 42, 0.4);
    color: #94a3b8;
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      border-color: rgba(245, 158, 11, 0.4);
    }

    &.active {
      background: rgba(245, 158, 11, 0.2);
      border-color: rgba(245, 158, 11, 0.5);
      color: #fcd34d;
    }
  }
}

.symbols-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding-right: 4px;
  align-content: start;
}

.symbol-card {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(51, 65, 85, 0.6);
  color: #cbd5e1;
  position: relative;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  padding: 4px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(30, 41, 59, 0.8);
    border-color: rgba(245, 158, 11, 0.5);
    color: #fde68a;
  }

  &.selected {
    background: rgba(245, 158, 11, 0.25);
    border-color: #fbbf24;
    color: #fcd34d;
    box-shadow: 0 0 12px rgba(251, 191, 36, 0.3);
  }

  .char-symbol {
    font-size: 1.35rem;
    line-height: 1;
    margin-bottom: 2px;
  }

  .char-pinyin {
    font-size: 0.65rem;
    opacity: 0.75;
    font-family: monospace;
  }

  .card-hover-overlay {
    position: absolute;
    inset: 0;
    background: rgba(245, 158, 11, 0.15);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  &:hover .card-hover-overlay {
    opacity: 1;
  }
}

.info-box {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(51, 65, 85, 0.6);
  background: rgba(15, 23, 42, 0.5);
  border-radius: 12px;
  padding: 12px;
  min-height: 90px;

  .info-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;

    .info-char {
      font-size: 1.6rem;
      color: #fbbf24;
      font-weight: 500;
      line-height: 1;
    }

    .info-meta {
      .info-trans {
        font-size: 0.8rem;
        font-weight: 600;
        color: #f1f5f9;

        .info-pinyin {
          font-size: 0.7rem;
          color: rgba(251, 191, 36, 0.8);
          font-family: monospace;
          margin-left: 4px;
        }
      }

      .info-sub {
        font-size: 0.7rem;
        color: #94a3b8;
      }
    }
  }

  .info-etymology {
    margin: 0;
    font-size: 0.725rem;
    color: #94a3b8;
    line-height: 1.4;
  }

  .info-placeholder {
    margin: 0;
    font-size: 0.75rem;
    color: #64748b;
    text-align: center;
    line-height: 1.5;
  }
}

.scrolls-desc {
  font-size: 0.75rem;
  color: #94a3b8;
  margin: 0 0 12px;
}

.scrolls-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;
}

.scroll-card {
  padding: 14px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(51, 65, 85, 0.6);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(245, 158, 11, 0.4);
    background: rgba(15, 23, 42, 0.8);
  }

  &.active {
    background: rgba(120, 53, 15, 0.3);
    border-color: rgba(245, 158, 11, 0.6);
    box-shadow: 0 0 20px rgba(245, 158, 11, 0.15);
  }

  .scroll-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .scroll-info {
      display: flex;
      align-items: center;
      gap: 10px;

      .scroll-char-box {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        color: #fbbf24;
      }

      .scroll-title {
        margin: 0;
        font-size: 0.85rem;
        font-weight: 500;
        color: #fcd34d;
        display: flex;
        align-items: center;
        gap: 6px;

        .check-icon {
          color: #34d399;
          font-size: 0.75rem;
        }
      }

      .scroll-target {
        font-size: 0.7rem;
        color: #94a3b8;

        .highlight {
          color: #fef08a;
          font-weight: 500;
        }
      }
    }

    .difficulty-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.65rem;
      font-weight: 500;
      border: 1px solid transparent;

      &.badge-easy {
        background: rgba(6, 78, 59, 0.6);
        color: #6ee7b7;
        border-color: rgba(6, 95, 70, 0.5);
      }
      &.badge-medium {
        background: rgba(120, 53, 15, 0.6);
        color: #fcd34d;
        border-color: rgba(146, 64, 14, 0.5);
      }
      &.badge-hard {
        background: rgba(124, 45, 18, 0.6);
        color: #fdba74;
        border-color: rgba(154, 52, 18, 0.5);
      }
      &.badge-legendary {
        background: rgba(88, 28, 135, 0.6);
        color: #d8b4fe;
        border-color: rgba(107, 33, 168, 0.5);
      }
      &.badge-default {
        background: rgba(30, 41, 59, 0.8);
        color: #cbd5e1;
      }
    }
  }

  .scroll-hint {
    margin: 0;
    font-size: 0.7rem;
    color: #94a3b8;
    font-style: italic;
    background: rgba(2, 6, 23, 0.4);
    padding: 8px;
    border-radius: 8px;
    border: 1px solid rgba(51, 65, 85, 0.5);
  }

  .scroll-card-footer {
    display: flex;
    justify-content: flex-end;

    .select-scroll-btn {
      padding: 4px 12px;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 500;
      background: rgba(245, 158, 11, 0.2);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fcd34d;
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(245, 158, 11, 0.35);
      }

      .play-icon {
        font-size: 0.8rem;
      }
    }
  }
}


.toggle-btn {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(2, 6, 23, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: #fbbf24;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);

  &.is-open {
    left: 456px;
  }

  &:hover {
    color: #fffbeb;
    background: rgba(15, 23, 42, 0.9);
    border-color: #fbbf24;
  }

  .toggle-icon {
    font-size: 1.35rem;
  }

  .glow-bg {
    position: absolute;
    inset: 0;
    border-radius: 12px;
    background: rgba(245, 158, 11, 0.15);
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  &:hover .glow-bg {
    opacity: 1;
  }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.4);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(245, 158, 11, 0.3);
  border-radius: 4px;
}

.ink-slide-enter-active, .ink-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.ink-slide-enter-from, .ink-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>
