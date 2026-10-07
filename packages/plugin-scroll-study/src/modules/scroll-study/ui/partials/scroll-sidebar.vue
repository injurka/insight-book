<script setup lang="ts">
import type { CharacterData } from '../../../../data'
import { Icon } from '@iconify/vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { allCharacters } from '../../../../data'
import { formatPinyin } from '../../lib/format-pinyin'
import { playUiSound } from '../../lib/ui-sound'
import { useScrollStudyStore } from '../../model/scroll-study.store'
import GamePanelFrame from './game-panel-frame.vue'
import ParchmentScrollbar from './parchment-scrollbar.vue'

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

interface Props {
  isOpen: boolean
  activeTab: 'symbols' | 'scrolls'
  compact: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void
  (e: 'update:activeTab', value: 'symbols' | 'scrolls'): void
  (e: 'symbolSelected', item: CharacterData): void
  (e: 'pointerdownSymbol', event: PointerEvent, item: CharacterData): void
}>()

const toggleRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)

watch(() => props.isOpen, async (open) => {
  const focusWasInPanel = panelRef.value?.contains(document.activeElement)
  await nextTick()
  if (!open && focusWasInPanel)
    toggleRef.value?.focus()
})

const mysteryScrolls: MysteryScrollData[] = []

const scrollStore = useScrollStudyStore()

const searchQuery = ref('')

const filteredCharacters = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q)
    return allCharacters

  return allCharacters.filter((item) => {
    const matchesChar = item.char.includes(q)
    const matchesPinyin = item.pinyin.toLowerCase().includes(q)
    const matchesTrans = item.translation.toLowerCase().includes(q)

    return matchesChar || matchesPinyin || matchesTrans
  })
})

// Virtualize whole rows so the palette keeps its responsive square-card layout.
const symbolsGridRef = ref<HTMLElement | null>(null)
const gridWidth = ref(0)
const gridHeight = ref(0)
const gridScrollTop = ref(0)
const gridGap = 8
const overscanRows = 3
const columnCount = computed(() => Math.max(1, Math.min(
  filteredCharacters.value.length || 1,
  Math.floor((gridWidth.value + gridGap) / (64 + gridGap)),
)))
const rowHeight = computed(() => (gridWidth.value - (columnCount.value - 1) * gridGap) / columnCount.value + gridGap)
const rowCount = computed(() => Math.ceil(filteredCharacters.value.length / columnCount.value))
const totalHeight = computed(() => Math.max(0, rowCount.value * rowHeight.value - gridGap))
const startRow = computed(() => Math.max(0, Math.min(
  rowCount.value - 1,
  Math.floor(Math.max(0, gridScrollTop.value - 3) / rowHeight.value),
) - overscanRows))
const endRow = computed(() => Math.min(rowCount.value,
  Math.ceil((gridScrollTop.value + gridHeight.value) / rowHeight.value) + overscanRows,
))
const visibleCharacters = computed(() => filteredCharacters.value.slice(
  startRow.value * columnCount.value,
  endRow.value * columnCount.value,
))

let gridResizeObserver: ResizeObserver | undefined
watch(symbolsGridRef, (element) => {
  gridResizeObserver?.disconnect()
  if (!element)
    return

  const measure = () => {
    const content = element.querySelector<HTMLElement>('.parchment-scrollbar-content')
    if (!content)
      return
    const style = getComputedStyle(content)
    gridWidth.value = Math.max(1, content.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight))
    gridHeight.value = element.clientHeight
    gridScrollTop.value = element.scrollTop
  }
  measure()
  gridResizeObserver = new ResizeObserver(measure)
  gridResizeObserver.observe(element)
}, { flush: 'post' })

watch(searchQuery, () => {
  gridScrollTop.value = 0
  if (symbolsGridRef.value)
    symbolsGridRef.value.scrollTop = 0
}, { flush: 'sync' })

onBeforeUnmount(() => gridResizeObserver?.disconnect())

function onSymbolsScroll(event: Event) {
  gridScrollTop.value = (event.currentTarget as HTMLElement).scrollTop
}

async function onSymbolKeydown(event: KeyboardEvent, index: number) {
  if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey)
    return

  const nextIndex = index + (event.shiftKey ? -1 : 1)
  const element = symbolsGridRef.value
  if (!element || nextIndex < 0 || nextIndex >= filteredCharacters.value.length)
    return

  event.preventDefault()
  const top = 3 + Math.floor(nextIndex / columnCount.value) * rowHeight.value
  const bottom = top + rowHeight.value - gridGap
  if (top < element.scrollTop)
    element.scrollTop = top
  else if (bottom > element.scrollTop + element.clientHeight)
    element.scrollTop = bottom - element.clientHeight
  gridScrollTop.value = element.scrollTop
  await nextTick()
  element.querySelector<HTMLButtonElement>(`[data-symbol-index="${nextIndex}"]`)?.focus({ preventScroll: true })
}

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
  emit('symbolSelected', item)
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
  <div class="sidebar-wrapper" :class="{ 'is-compact': compact }" @keydown.esc="emit('update:isOpen', false)">
    <button
      v-if="compact && isOpen"
      class="panel-backdrop"
      aria-label="Вернуться к игровому полю"
      tabindex="-1"
      @click="emit('update:isOpen', false)"
    />
    <!-- Framed parchment panel -->
    <Transition name="ink-slide">
      <section
        v-if="isOpen"
        id="scroll-study-palette"
        ref="panelRef"
        class="sidebar-panel"
        aria-label="Знаки и свитки"
      >
        <div class="sidebar-art" aria-hidden="true" />
        <GamePanelFrame />
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
              <button
                v-if="searchQuery"
                class="clear-btn"
                aria-label="Очистить поиск"
                @click="searchQuery = ''"
              >
                <Icon icon="mdi:close" />
              </button>
            </div>
          </div>

          <!-- Symbols Grid -->
          <ParchmentScrollbar class="symbols-grid" @ready="symbolsGridRef = $event" @scroll="onSymbolsScroll">
            <div class="symbols-spacer" :style="{ height: `${totalHeight}px` }">
              <div
                class="symbols-window"
                :style="{
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                  transform: `translateY(${startRow * rowHeight}px)`,
                }"
              >
                <button
                  v-for="(item, index) in visibleCharacters"
                  :key="item.id"
                  :data-symbol-index="startRow * columnCount + index"
                  @keydown="onSymbolKeydown($event, startRow * columnCount + index)"
                  class="symbol-card"
                  :class="{ selected: scrollStore.selectedTablet === item.char }"
                  :aria-pressed="scrollStore.selectedTablet === item.char"
                  @click="selectSymbol(item)"
                  @pointerdown="emit('pointerdownSymbol', $event, item)"
                >
                  <span class="char-symbol">{{ item.char }}</span>
                  <span class="char-pinyin">{{ formatPinyin(item.pinyin) }}</span>
                  <div class="card-hover-overlay" />
                </button>
              </div>
            </div>
          </ParchmentScrollbar>
        </div>

        <!-- TAB 2: SCROLLS SELECTION -->
        <div v-else-if="activeTab === 'scrolls'" class="tab-content">
          <p class="scrolls-desc">
            Выберите древний свиток для постижения тайных связей знаков.
          </p>

          <ParchmentScrollbar class="scrolls-list">
            <div class="scrolls-content">
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
          </ParchmentScrollbar>
        </div>
      </section>
    </Transition>

    <!-- Attached Toggle Button -->
    <button
      ref="toggleRef"
      class="toggle-btn"
      aria-controls="scroll-study-palette"
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
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}

.sidebar-panel,
.toggle-btn {
  pointer-events: auto;
}

.sidebar-panel {
  box-sizing: border-box;
  position: absolute;
  top: var(--game-top);
  left: var(--game-left);
  bottom: var(--game-bottom);
  width: min(var(--panel-width), calc(100% - var(--game-left) - var(--game-right)));
  display: flex;
  flex-direction: column;
  padding: 40px 32px;
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
  filter: brightness(0.78) saturate(0.85);
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
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
    border-radius: 10px;
    padding: 12px 32px 12px 34px;
    font-size: 1rem;
    min-height: 44px;
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

.panel-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: #02061780;
  pointer-events: auto;
}

.sidebar-wrapper.is-compact .sidebar-panel {
  top: max(calc(var(--game-top)), 26%);
  left: max(var(--game-left), calc((100% - var(--panel-width)) / 2));
  --panel-corner: 36px;
  --panel-rail: 28px;
  padding: 32px 24px;
}

.symbols-grid {
  flex: 1;
  min-height: 0;

  :deep(.parchment-scrollbar-content) {
    padding: 3px 21px 8px 3px;
  }
}

.symbols-spacer {
  position: relative;
}

.symbols-window {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: grid;
  gap: 8px;
}

.symbol-card {
  box-sizing: border-box;
  min-width: 0;
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
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: #8e5c32;
    color: #48250f;
    box-shadow: 0 3px 6px #48250f20;
  }

  &.selected {
    background: linear-gradient(180deg, rgba(248, 223, 172, 0.87), rgba(235, 202, 141, 0.87));
    border-color: #8e5c32;
    color: #422009;
    box-shadow:
      inset 0 0 0 1px #8e5c32,
      0 2px 3px #48250f12;
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

.scrolls-desc {
  font-size: 0.75rem;
  color: #694221;
  margin: 0 0 12px;
}

.scrolls-list {
  flex: 1;
}

.scrolls-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 21px;
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
  top: var(--game-top);
  left: var(--game-left);
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
    left: calc(var(--game-left) + var(--panel-width) + var(--game-gap));
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

.sidebar-wrapper.is-compact .toggle-btn.is-open {
  left: var(--game-left);
}

.symbol-card:focus-visible {
  outline: 2px solid #8e5c32;
  outline-offset: 2px;
}

.toggle-btn:focus-visible,
.clear-btn:focus-visible {
  outline: 2px solid #ffe19a;
  outline-offset: 2px;
}


.ink-slide-enter-active,
.ink-slide-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.ink-slide-enter-from,
.ink-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
.sidebar-wrapper.is-compact .ink-slide-enter-from,
.sidebar-wrapper.is-compact .ink-slide-leave-to {
  transform: translateY(24px);
}

@container scroll-study (max-height: 600px) {
  .sidebar-wrapper.is-compact .sidebar-panel {
    top: calc(var(--game-top));
    padding-block: 28px;
  }

  .filter-controls {
    margin-bottom: 8px;
  }
}
</style>
