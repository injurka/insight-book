<script setup lang="ts">
import type { CharacterData } from '../../../../data'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { allCharacters } from '../../../../data'
import { formatPinyin } from '../../lib/format-pinyin'
import { playUiSound } from '../../lib/ui-sound'
import { useScrollStudyStore } from '../../model/scroll-study.store'
import GamePanelFrame from './game-panel-frame.vue'

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

defineProps<{
  isOpen: boolean
  activeTab: 'symbols' | 'scrolls'
}>()

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void
  (e: 'update:activeTab', value: 'symbols' | 'scrolls'): void
  (e: 'pointerdownSymbol', event: PointerEvent, item: CharacterData): void
}>()

const mysteryScrolls: MysteryScrollData[] = []

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

function selectSymbol(item: CharacterData) {
  scrollStore.selectedTablet = item.char
  playUiSound('select')
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
    <!-- Framed parchment panel -->
    <Transition name="ink-slide">
      <div v-if="isOpen" class="sidebar-panel">
        <div class="sidebar-art" aria-hidden="true" />
        <GamePanelFrame  />
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
                aria-label="Поиск иероглифов"
              >
              <Icon icon="mdi:magnify" class="search-icon" />
              <button v-if="searchQuery" class="clear-btn" aria-label="Очистить поиск" @click="searchQuery = ''">
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
              :aria-pressed="scrollStore.selectedTablet === item.char"
              @click="selectSymbol(item)"
              @pointerdown="emit('pointerdownSymbol', $event, item)"
              @mouseenter="hoveredChar = item"
              @mouseleave="hoveredChar = null"
              @focus="hoveredChar = item"
              @blur="hoveredChar = null"
            >
              <span class="char-symbol">{{ item.char }}</span>
              <span class="char-pinyin">{{ formatPinyin(item.pinyin) }}</span>
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
                      [{{ formatPinyin((hoveredChar || selectedCharObj)?.pinyin ?? '') }}]
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
                      Цель: <span class="highlight">{{ scroll.translation }}</span> [{{ formatPinyin(scroll.pinyin) }}]
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
      :aria-expanded="isOpen"
      :aria-label="isOpen ? 'Свернуть панель' : 'Открыть меню знаков и свитков'"
      :title="isOpen ? 'Свернуть панель' : 'Открыть меню знаков и свитков'"
      @click="emit('update:isOpen', !isOpen)"
    >
      <Icon :icon="isOpen ? 'mdi:close' : 'mdi:script-text-outline'" class="toggle-icon" />
    </button>
  </div>
</template>

<style lang="scss" scoped>
.sidebar-wrapper {
  position: relative;
  z-index: 20;
}

.sidebar-panel {
  box-sizing: border-box;
  position: absolute;
  top: 24px;
  left: 24px;
  width: 420px;
  height: calc(100% - 48px);
  display: flex;
  flex-direction: column;
  padding: 48px 32px;
  isolation: isolate;
  color: #48250f;
  border-radius: 8px;
  overflow: hidden;
}

.sidebar-art {
  position: absolute;
  inset: 18px;
  z-index: -1;
  pointer-events: none;
  background: url('../../../../assets/sidebar/parchment-art.webp') center bottom / cover no-repeat;
}

.tab-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.filter-controls {
  flex-shrink: 0;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-box {
  position: relative;
  display: flex;

  .search-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(239, 217, 176, 0.8);
    border: 1px solid #b79a70;
    box-shadow: inset 0 1px 2px #48250f0a;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    border-radius: 10px;
    padding: 12px 32px 12px 34px;
    font-size: 0.8rem;
    color: #48250f;

    &::placeholder {
      color: #79552e;
    }

    &:focus {
      outline: none;
      border-color: #8e5c32;
      box-shadow: 0 0 0 3px #8e5c3226;
    }
  }

  .search-icon {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #79552e;
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
    color: #79552e;
    cursor: pointer;

    &:hover {
      color: #48250f;
    }
  }
}

.tier-pills {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 5px;
  border: 1px solid #b79a70;
  border-radius: 10px;
  background: rgba(222, 193, 148, 0.76);
  box-shadow: inset 0 1px 2px #48250f0a;

  .tier-pill {
    flex: 1;
    padding: 7px 6px;
    border-radius: 6px;
    font-size: 0.7rem;
    border: 1px solid transparent;
    background: transparent;
    color: #684421;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease;

    &:hover {
      background: rgba(239, 217, 176, 0.6);
      border-color: #b79a70;
    }

    &.active {
      background: rgba(239, 217, 176, 0.84);
      border-color: #8e5c32;
      color: #48250f;
      box-shadow: 0 1px 3px #48250f1a;
    }
  }
}

.symbols-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: max-content;
  gap: 8px;
  padding: 3px 5px 8px 3px;
  align-content: start;
}

.symbol-card {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(239, 217, 176, 0.78), rgba(227, 198, 151, 0.78));
  border: 1px solid #b79a70;
  box-shadow: 0 2px 3px #48250f12;
  color: #48250f;
  position: relative;
  overflow: hidden;
  cursor: grab;
  padding: 4px;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    border-color: #8e5c32;
    color: #48250f;
    box-shadow: 0 3px 6px #48250f20;
  }

  &.selected {
    background: linear-gradient(180deg, rgba(248, 223, 172, 0.87), rgba(235, 202, 141, 0.87));
    border-color: #8e5c32;
    color: #422009;
    box-shadow: inset 0 0 0 1px #8e5c32, 0 2px 3px #48250f12;
  }

  .char-symbol {
    font-size: 1.85rem;
    line-height: 1;
    margin-bottom: 2px;
  }

  .char-pinyin {
    font-size: 0.65rem;
    opacity: 0.75;
    font-family: inherit;
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
  flex-shrink: 0;
  margin-top: 16px;
  border: 1px solid #b9843e;
  box-sizing: border-box;
  background: rgba(242, 211, 154, 0.82);
  border-image: url('../../../../assets/sidebar/info-parchment.png') 64 fill / 9px;
  border-radius: 8px;
  padding: 18px 20px;
  min-height: 125px;
  box-shadow: 0 4px 10px #48250f66;

  .info-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;

    .info-char {
      font-size: 1.6rem;
      color: #ad641b;
      text-shadow: 0 1px #ffedbc;
      font-weight: 500;
      line-height: 1;
    }

    .info-meta {
      .info-trans {
        font-size: 0.8rem;
        font-weight: 600;
        color: #48250f;

        .info-pinyin {
          font-size: 0.7rem;
          color: #a4611c;
          font-family: 'Maple Mono CN', monospace;
          margin-left: 4px;
        }
      }

      .info-sub {
        font-size: 0.7rem;
        color: #694221;
      }
    }
  }

  .info-etymology {
    margin: 0;
    font-size: 0.725rem;
    color: #694221;
    line-height: 1.4;
  }

  .info-placeholder {
    margin: 0;
    font-size: 0.75rem;
    color: #79552e;
    text-align: center;
    line-height: 1.5;
  }
}

.scrolls-desc {
  font-size: 0.75rem;
  color: #694221;
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
  background: rgba(248, 219, 165, 0.92);
  border: 1px solid #ad7339;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(245, 158, 11, 0.4);
    background: rgba(243, 208, 144, 0.95);
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
        color: #694221;

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
        background: rgba(248, 215, 150, 0.95);
        color: #48250f;
      }
    }
  }

  .scroll-hint {
    margin: 0;
    font-size: 0.7rem;
    color: #694221;
    font-style: italic;
    background: rgba(156, 92, 35, 0.12);
    padding: 8px;
    border-radius: 8px;
    border: 1px solid #ad733980;
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
  background: url('../../../../assets/ui-kit/square-button/normal.png') center / 100% 100% no-repeat;
  box-shadow: 0 4px 12px #160a0599;
  border: 0;
  color: #c4a16c;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);


  &.is-open {
    left: 456px;
  }

  &:hover:not(:disabled) {
    color: #ddc298;
    background-image: url('../../../../assets/ui-kit/square-button/hover.png');
  }

  &:active:not(:disabled) {
    background-image: url('../../../../assets/ui-kit/square-button/pressed.png');
  }

  &:disabled {
    background-image: url('../../../../assets/ui-kit/square-button/disabled.png');
    color: #a6957e;
    cursor: not-allowed;
  }

  .toggle-icon {
    font-size: 1.35rem;
  }

}

.symbol-card:focus-visible {
  outline: 2px solid #8e5c32;
  outline-offset: 2px;
}

.tier-pill:focus-visible {
  outline: 2px solid #8e5c32;
  outline-offset: 1px;
}

.toggle-btn:focus-visible,
.clear-btn:focus-visible {
  outline: 2px solid #ffe19a;
  outline-offset: 2px;
}

.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: #a4611c #6a321830;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(87, 38, 13, 0.75);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(245, 158, 11, 0.3);
  border-radius: 4px;
}

.ink-slide-enter-active,
.ink-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.ink-slide-enter-from,
.ink-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
@container scroll-study (max-width: 1500px) {
  .sidebar-wrapper {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .sidebar-panel {
    top: 12px;
    left: 12px;
    width: min(320px, calc(100cqw - 80px));
    height: calc(100% - 24px);
    padding: 32px 28px;
    border-radius: 8px;
    pointer-events: auto;
  }

  .toggle-btn {
    top: 12px;
    left: 12px;
    pointer-events: auto;

    &.is-open {
      left: calc(min(320px, calc(100cqw - 80px)) + 20px);
    }
  }

  .search-box .search-input {
    box-sizing: border-box;
    min-height: 44px;
    font-size: 16px;
  }

  .tier-pills {
    flex-shrink: 0;

    .tier-pill {
      min-height: 36px;
      flex-shrink: 0;
    }
  }

  .symbols-grid {
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 6px;
    overscroll-behavior: contain;
  }

  .symbol-card {
    min-width: 0;
    min-height: 60px;
    touch-action: pan-y;
  }

  .info-box {
    display: none;
  }

  .ink-slide-enter-from,
  .ink-slide-leave-to {
    transform: translateX(-30px);
  }
}

@container scroll-study (min-width: 901px) {
  .symbol-card {
    user-select: none;
  }
}
</style>
