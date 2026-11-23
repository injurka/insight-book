<script setup lang="ts">
import type { SentenceTab } from '../../../../shared/lib/sentence-view'
import { Icon } from '@iconify/vue'
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  tabs: SentenceTab[]
}

const props = defineProps<Props>()
/** Ключ выбранного предложения; `null` — все предложения сразу. */
const model = defineModel<number | null>({ required: true })

const { t } = useI18n()
const track = useTemplateRef<HTMLElement>('trackRef')

const options = computed<(number | null)[]>(() => [null, ...props.tabs.map(tab => tab.index)])

watch(model, () => revealActiveTab())

function getTab(): HTMLElement | null {
  return track.value?.querySelector<HTMLElement>('[aria-selected="true"]') ?? null
}
async function revealActiveTab(focus = false): Promise<void> {
  await nextTick()

  const tab = getTab()

  tab?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })

  if (focus) {
    tab?.focus({ preventScroll: true })
  }
}
function onKeydown(event: KeyboardEvent): void {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0

  if (step === 0) {
    return
  }

  event.preventDefault()

  const current = options.value.indexOf(model.value)
  const next = (current + step + options.value.length) % options.value.length

  model.value = options.value[next]
  void revealActiveTab(true)
}
</script>

<template>
  <nav class="sentence-switcher" :aria-label="t('plugins.chinese-analyzer.sentenceSwitcherLabel')">
    <div
      ref="trackRef"
      class="switcher-track"
      role="tablist"
      @keydown="onKeydown"
    >
      <button
        type="button"
        role="tab"
        class="switcher-chip chip-all"
        :aria-selected="model === null"
        :tabindex="model === null ? 0 : -1"
        @click="model = null"
      >
        <Icon icon="mdi:format-list-numbered" class="chip-icon" />
        <span>{{ t('plugins.chinese-analyzer.sentenceAll') }}</span>
      </button>

      <button
        v-for="tab in tabs"
        :key="tab.index"
        type="button"
        role="tab"
        class="switcher-chip"
        :title="tab.hanzi"
        :aria-selected="model === tab.index"
        :tabindex="model === tab.index ? 0 : -1"
        @click="model = tab.index"
      >
        <span class="chip-order">{{ tab.order }}</span>
        <span class="chip-hanzi">{{ tab.hanzi }}</span>
      </button>
    </div>
  </nav>
</template>

<style lang="scss" scoped>
.sentence-switcher {
  position: sticky;
  top: calc(8px + var(--safe-area-top, env(safe-area-inset-top, 0px)));
  z-index: 20;
  padding: 5px;
  border-radius: 16px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);

  @include media-down(sm) {
    top: calc(6px + var(--safe-area-top, env(safe-area-inset-top, 0px)));
    padding: 4px;
    border-radius: 14px;
  }
}

.switcher-track {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
  overscroll-behavior-x: contain;

  &::-webkit-scrollbar {
    display: none;
  }
}

.switcher-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  max-width: 240px;
  height: 38px;
  padding: 0 14px 0 8px;
  border-radius: 11px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--fg-secondary-color);
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease;

  &.chip-all {
    padding-left: 12px;
  }

  &:hover {
    background: var(--bg-tertiary-color);
    color: var(--fg-primary-color);
  }

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: -2px;
  }

  &[aria-selected='true'] {
    background: rgba(var(--fg-accent-color-rgb), 0.14);
    border-color: rgba(var(--fg-accent-color-rgb), 0.4);
    color: var(--fg-accent-color);
  }

  @include media-down(sm) {
    max-width: 150px;
    height: 34px;
    gap: 6px;
    padding: 0 10px 0 6px;
    font-size: 0.82rem;

    &.chip-all {
      padding-left: 10px;
    }
  }
}

.chip-icon {
  font-size: 1.05rem;
}

.chip-order {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: var(--bg-tertiary-color);
  font-size: 0.74rem;
  font-weight: 800;

  [aria-selected='true'] > & {
    background: var(--fg-accent-color);
    color: #ffffff;
  }

  @include media-down(sm) {
    width: 20px;
    height: 20px;
    font-size: 0.68rem;
  }
}

.chip-hanzi {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
