<script setup lang="ts">
import type { PuzzleNode } from '../../model/types'
import { computed, onMounted, onUnmounted, useId, useTemplateRef, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { allCharacters } from '../../../../data'
import { formatPinyin } from '../../lib/format-pinyin'
import { useScrollStudyStore } from '../../model/scroll-study.store'

interface Props {
  node: PuzzleNode
}
const props = defineProps<Props>()
const emit = defineEmits<{ openChange: [open: boolean] }>()
const store = useScrollStudyStore()
let trigger: HTMLElement | undefined
const panel = useTemplateRef<HTMLDivElement>('panel')
const id = useId()
const character = computed(() => allCharacters.find(item => item.char === props.node.character))

function close(event?: Event) {
  if (event?.target instanceof Node && panel.value?.contains(event.target))
    return
  panel.value?.hidePopover()
}

function onToggle(event: ToggleEvent) {
  emit('openChange', event.newState === 'open')
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
  const rect = anchor.getBoundingClientRect()
  const gap = 8
  const left = Math.max(gap, Math.min(rect.left + rect.width / 2 - element.offsetWidth / 2, window.innerWidth - element.offsetWidth - gap))
  const below = rect.bottom + gap
  const top = below + element.offsetHeight <= window.innerHeight - gap
    ? below
    : Math.max(gap, rect.top - element.offsetHeight - gap)
  element.style.left = `${left}px`
  element.style.top = `${top}px`
  element.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
}

function dismiss() {
  close()
  trigger?.focus({ preventScroll: true })
}

onMounted(() => window.addEventListener('resize', close))
onUnmounted(() => window.removeEventListener('resize', close))
watch(() => store.activeGrid, () => close())
defineExpose({ toggle, id })
</script>

<template>
  <Teleport to="body">
    <div
      :id="id" ref="panel" popover="auto" class="anchor-info" role="dialog"
      :aria-labelledby="`${id}-title`" @toggle="onToggle" @click.stop
      @keydown.esc="trigger?.focus({ preventScroll: true })"
    >
      <header class="info-header">
        <span class="eyebrow"><Icon icon="mdi:map-marker-outline" /> Опорный символ</span>
        <button class="close-button" type="button" aria-label="Закрыть сведения о символе" @click="dismiss">
          <Icon icon="mdi:close" />
        </button>
      </header>
      <div class="identity">
        <span class="symbol" aria-hidden="true">{{ node.character }}</span>
        <div class="meaning">
          <p v-if="character" class="pronunciation">{{ formatPinyin(character.pinyin) }}</p>
          <h3 :id="`${id}-title`">{{ character?.translation || `Символ ${node.character}` }}</h3>
          <p v-if="character" class="word-kind">{{ character.isStandaloneWord ? 'Самостоятельное слово' : 'Компонент иероглифа' }}</p>
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
  width: min(340px, calc(100vw - 24px));
  overflow: hidden;
  padding: 17px;
  border: 12px solid transparent;
  border-image: url('../../../../assets/sidebar/popover-parchment.webp') 64 / 12px / 0 stretch;
  background-color: #efd9b0;
  background-image: url('../../../../assets/sidebar/popover-paper-tile.webp');
  background-size: 180px 180px;
  background-repeat: repeat;
  background-clip: padding-box;
  color: #382719;
  box-shadow: 0 12px 36px #24140842, 0 3px 10px #24140820;
  font: 14px/1.5 'Maple Mono CN', monospace;
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

@media (min-width: 901px) {
  .anchor-info {
    user-select: text;
  }
}
@starting-style {
  .anchor-info:popover-open {
    opacity: 0;
    transform: scale(0.97) translateY(7px);
  }
}
.anchor-info:not(:popover-open) {
  opacity: 0;
  transform: scale(0.98) translateY(4px);
}
@media (prefers-reduced-motion: reduce) {
  .anchor-info {
    transition: none;
  }
}
h3, p { margin: 0; }
.info-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.eyebrow { display: flex; align-items: center; gap: 5px; color: #775535; font-size: 10px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; }
.close-button { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 1px solid #a8875d70; border-radius: 50%; background: #ead4ad; color: #68482b; font-size: 16px; cursor: pointer; }
.close-button:hover { background: #dfc294; }
.close-button:focus-visible { outline: 2px solid #8e5c32; outline-offset: 2px; }
.identity { display: flex; align-items: center; gap: 15px; }
.symbol { display: grid; place-items: center; flex-shrink: 0; width: 72px; height: 72px; border: 1px solid #a8875d70; border-radius: 10px; background: #e8d1a8; color: #74351e; font: 44px/1.2 'Maple Mono CN', monospace; box-shadow: inset 0 1px 3px #48250f12; }
.meaning { min-width: 0; }
h3 { font-size: 20px; line-height: 1.25; overflow-wrap: anywhere; }
.pronunciation { margin-bottom: 3px; color: #925328; font-size: 14px; font-weight: 600; }
.word-kind { margin-top: 5px; color: #775535; font-size: 11px; }
.facts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 13px; padding-top: 11px; border-top: 1px solid #8e674338; }
.facts span { padding: 3px 8px; border: 1px solid #8e674338; border-radius: 999px; background: #e8d1a88c; color: #68482b; font-size: 10px; }
@media (max-width: 420px) {
  .anchor-info { padding: 14px; }
  .symbol { width: 62px; height: 64px; font-size: 38px; }
  h3 { font-size: 18px; }
}
</style>
