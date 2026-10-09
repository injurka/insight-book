<script setup lang="ts">
import type { PuzzleNode } from '../../model/types'
import { Icon } from '@iconify/vue'
import { computed, onMounted, onUnmounted, useId, useTemplateRef, watch } from 'vue'
import { allCharacters } from '../../../../data'
import { formatPinyin } from '../../lib/format-pinyin'
import { useScrollStudyStore } from '../../model/scroll-study.store'

interface Props {
  node: PuzzleNode
}

const props = defineProps<Props>()
const emit = defineEmits<{ openChange: [open: boolean] }>()

const store = useScrollStudyStore()
const panel = useTemplateRef<HTMLDivElement>('panel')
const id = useId()

defineExpose({ toggle, id })

let trigger: HTMLElement | undefined

const character = computed(() => allCharacters.find(item => item.char === props.node.character))

watch(() => store.activeGrid, () => close())

function close(event?: Event) {
  if (event?.target instanceof Node && panel.value?.contains(event.target))
    return

  panel.value?.hidePopover()
}
function onToggle(event: ToggleEvent) {
  const open = event.newState === 'open'
  emit('openChange', open)
}
function toggle(anchor: HTMLElement) {
  const element = panel.value

  if (!element)
    return

  if (element.matches(':popover-open')) {
    element.hidePopover()

    return
  }

  trigger = anchor
  element.showPopover()
  positionPanel()
  element.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
}
function getSceneBounds(board: Element) {
  const scene = board.closest('.scroll-desktop-view')?.getBoundingClientRect()

  return {
    top: Math.max(0, scene?.top ?? 0),
    right: Math.min(window.innerWidth, scene?.right ?? window.innerWidth),
    bottom: Math.min(window.innerHeight, scene?.bottom ?? window.innerHeight),
  }
}
function positionPanel() {
  const element = panel.value
  const board = trigger?.closest('.research-board-container')

  if (!element?.matches(':popover-open') || !board)
    return

  const rect = board.getBoundingClientRect()
  const bounds = getSceneBounds(board)
  const gap = 12
  const right = bounds.right - gap
  const width = element.offsetWidth
  const left = Math.max(gap, Math.min(rect.right + gap, right - width))
  const topEdge = bounds.top + gap
  const bottomEdge = bounds.bottom - gap
  element.style.maxHeight = `${Math.max(0, bottomEdge - topEdge)}px`
  element.style.left = `${left}px`
  element.style.top = `${Math.max(topEdge, Math.min(rect.top + rect.height / 2 - element.offsetHeight / 2, bottomEdge - element.offsetHeight))}px`
}
function dismiss() {
  close()
  trigger?.focus({ preventScroll: true })
}

onMounted(() => window.addEventListener('resize', close))
onUnmounted(() => window.removeEventListener('resize', close))
</script>

<template>
  <Teleport to="body">
    <div
      :id="id"
      ref="panel"
      popover="auto"
      class="anchor-info"
      role="dialog"
      :aria-labelledby="`${id}-title`"
      @toggle="onToggle"
      @click.stop
      @keydown.esc="trigger?.focus({ preventScroll: true })"
    >
      <button
        class="close-button"
        type="button"
        aria-label="Закрыть сведения о символе"
        @click="dismiss"
      >
        <Icon icon="mdi:close" />
      </button>

      <div class="identity">
        <span class="symbol" aria-hidden="true">{{ node.character }}</span>
        <div class="meaning">
          <p v-if="character" class="pronunciation">
            {{ formatPinyin(character.pinyin) }}
          </p>
          <h3 :id="`${id}-title`">
            {{ character?.translation || `Символ ${node.character}` }}
          </h3>
          <p v-if="character" class="word-kind">
            {{ character.isStandaloneWord ? 'Самостоятельное слово' : 'Компонент иероглифа' }}
          </p>
        </div>
      </div>
      <div v-if="character" class="facts" aria-label="Сведения об иероглифе">
        <span>{{ character.strokeCount }} черт</span>
        <span v-if="character.hskLevel">HSK {{ character.hskLevel }}</span>
        <span>Уровень {{ character.tier }}</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.anchor-info {
  position: fixed;
  inset: auto;
  margin: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 220px;
  height: 160px;
  max-width: calc(100vw - 24px);
  overflow: hidden;
  padding: 16px 12px 12px;
  border: 1px solid #947044;
  border-radius: 6px;
  background: linear-gradient(145deg, #302219, #1e1712);
  color: #ead9b9;
  box-shadow:
    0 8px 24px #0008,
    inset 0 0 0 2px #211810,
    inset 0 0 0 3px #73533240;
  font:
    12px/1.4 'Maple Mono CN',
    monospace;
  cursor: auto;
  opacity: 1;
  transform: scale(1) translateY(0);
  transform-origin: center;
  transition:
    opacity 180ms ease,
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    overlay 220ms allow-discrete,
    display 220ms allow-discrete;
}

.anchor-info,
.anchor-info * {
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.anchor-info::selection,
.anchor-info *::selection {
  background: transparent;
  color: inherit;
}
.anchor-info :focus:not(:focus-visible) {
  outline: none;
}
@starting-style {
  .anchor-info:popover-open {
    opacity: 0;
    transform: scale(0.97) translateY(7px);
  }
}
.anchor-info:not(:popover-open) {
  display: none;
  opacity: 0;
  transform: scale(0.98) translateY(4px);
}

h3,
p {
  margin: 0;
}

.close-button {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #bda27a;
  font-size: 16px;
  cursor: pointer;
}
.close-button:hover {
  background: #94704430;
  color: #f4e2be;
}
.close-button:focus-visible {
  outline: 2px solid #d0ac73;
  outline-offset: 2px;
}
.identity {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 22px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.symbol {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border: 1px solid #94704470;
  border-radius: 4px;
  background: #483222;
  color: #edc991;
  font:
    32px/1.2 'Maple Mono CN',
    monospace;
  box-shadow: inset 0 1px 3px #48250f12;
}
.meaning {
  min-width: 0;
}
h3 {
  font-size: 16px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.pronunciation {
  margin-bottom: 3px;
  color: #d0ac73;
  font-size: 14px;
  font-weight: 600;
}
.word-kind {
  margin-top: 5px;
  color: #bda27a;
  font-size: 11px;
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 0 0 auto;
  margin-top: 0;
  padding-top: 8px;
  border-top: 1px solid #94704450;
}
.facts span {
  color: #bda27a;
  font-size: 10px;
}
.facts span + span::before {
  content: '·';
  margin-right: 6px;
  opacity: 0.5;
}
</style>
