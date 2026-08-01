<script setup lang="ts">
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { Icon } from '@iconify/vue'
import { useResizeObserver } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'

const analysisStore = useAnalysisStore()

const popoverRef = ref<HTMLElement | null>(null)
const referenceEl = computed(() => analysisStore.grammarPopover?.target || null)

const { x, y, strategy } = useFloating(referenceEl, popoverRef, {
  placement: 'bottom',
  strategy: 'fixed',
  middleware: [
    offset(8),
    flip({ padding: 10 }),
    shift({ padding: 10 }),
  ],
  whileElementsMounted: autoUpdate,
})

const popoverPos = computed(() => {
  if (!analysisStore.grammarPopover || x.value == null || y.value == null)
    return { top: '-9999px', left: '-9999px', visibility: 'hidden' as const }

  return {
    position: strategy.value,
    top: `${y.value}px`,
    left: `${x.value}px`,
    visibility: 'visible' as const,
  }
})

const innerRef = ref<HTMLElement | null>(null)
const contentHeight = ref<string>('auto')

useResizeObserver(innerRef, (entries) => {
  const target = entries[0].target as HTMLElement
  contentHeight.value = `${target.offsetHeight}px`
})

function closePopover(event?: MouseEvent) {
  const target = event?.target as HTMLElement | null
  // Do not close if clicking inside the popover
  if (target?.closest('.grammar-popover'))
    return
  analysisStore.closeGrammarPopover()
}

onMounted(() => document.addEventListener('click', closePopover))
onUnmounted(() => document.removeEventListener('click', closePopover))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="analysisStore.grammarPopover"
        ref="popoverRef"
        class="grammar-popover"
        :style="popoverPos"
        @click.stop
      >
        <div class="grammar-header">
          <div class="header-pattern-badge">
            <Icon icon="mdi:puzzle-outline" class="pattern-icon" />
            <span class="header-text">{{ analysisStore.grammarPopover.pattern }}</span>
          </div>
          <button class="close-btn" @click.stop="analysisStore.closeGrammarPopover()">
            <Icon width="18" height="18" icon="mdi:chevron-down" />
          </button>
        </div>

        <div class="popover-content">
          <div class="height-animator" :style="{ height: contentHeight, transition: 'height 0.25s ease', overflow: 'hidden' }">
            <div ref="innerRef" class="popover-inner-grid">
              <div class="popover-body">
                <p class="section-content explanation-text">
                  {{ analysisStore.grammarPopover.explanation }}
                </p>

                <p v-if="analysisStore.grammarPopover.example" class="section-content example-text">
                  {{ analysisStore.grammarPopover.example }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.grammar-popover {
  position: fixed;
  z-index: var(--z-popover, 1300);
  background-color: var(--bg-tertiary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  width: 90vw;
  max-width: 420px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 50vh;
}

.grammar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px 16px;
  position: sticky;
  top: 0;
  z-index: 2;
  border-bottom: 1px solid var(--border-secondary-color, rgba(0, 0, 0, 0.05));

  .header-pattern-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--fg-accent-color);
    font-weight: 600;
    font-size: 1.1rem;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    padding-right: 28px;

    .pattern-icon {
      flex-shrink: 0;
      color: var(--fg-accent-color);
      font-size: 1.2rem;
    }

    .header-text {
      text-overflow: ellipsis;
      overflow: hidden;
    }
  }

  .close-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--fg-secondary-color);
    cursor: pointer;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition:
      background-color 0.2s,
      color 0.2s;

    &:hover {
      background-color: var(--bg-hover-color);
      color: var(--fg-primary-color);
    }

    svg {
      font-size: 1.4rem;
    }
  }
}

.popover-content {
  display: block;
  overflow-y: auto;
  flex: 1;

  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    display: none;
  }
}

.height-animator {
  width: 100%;
}

.popover-inner-grid {
  display: grid;
  grid-template-columns: 100%;
}

.popover-inner-grid > * {
  grid-column: 1;
  grid-row: 1;
}

.popover-body {
  padding: 12px 16px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-content {
  font-size: 0.95rem;
  line-height: 1.45;
  margin: 0;
  white-space: pre-wrap;
}

.explanation-text {
  color: var(--fg-primary-color);
}

.example-text {
  color: var(--fg-accent-color);
  background-color: var(--bg-hover-color, rgba(0, 0, 0, 0.02));
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 3px solid var(--fg-accent-color);
  font-style: italic;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
