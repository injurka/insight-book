<script setup lang="ts">
import { KitBtn, KitSkeleton } from '~/components/01.kit'
import { POS_TAGS_MAP } from '~/shared/constants/pos-tags'
import { useBooksStore } from '~/shared/store/books.store'

const store = useBooksStore()
const popoverRef = ref<HTMLElement | null>(null)
const popoverPos = ref({ top: '-9999px', left: '-9999px', transform: 'none' })

watch(
  () => store.wordPopover,
  async (val) => {
    if (!val) {
      popoverPos.value = { top: '-9999px', left: '-9999px', transform: 'none' }
      return
    }
    await nextTick()
    if (!popoverRef.value || !val.targetRect)
      return

    const rect = val.targetRect
    const popRect = popoverRef.value.getBoundingClientRect()
    const ww = window.innerWidth
    const wh = window.innerHeight

    let left = rect.left + rect.width / 2
    let top = rect.bottom + 8

    if (top + popRect.height > wh) {
      if (rect.top > popRect.height + 8) {
        top = rect.top - popRect.height - 8
      }
      else {
        top = wh - popRect.height - 10
      }
    }

    if (top < 10) {
      top = 10
    }

    if (left - popRect.width / 2 < 10) {
      left = popRect.width / 2 + 10
    }
    else if (left + popRect.width / 2 > ww - 10) {
      left = ww - popRect.width / 2 - 10
    }

    popoverPos.value = {
      top: `${top}px`,
      left: `${left}px`,
      transform: 'translateX(-50%)',
    }
  },
  { deep: true },
)

function openSaveDialog() {
  if (!store.wordPopover)
    return
  store.openAddEditWordModal(store.wordPopover)
  store.closePopover()
}

function closePopover(event?: MouseEvent) {
  const target = event?.target as HTMLElement | null
  if (target?.closest('.kit-dialog') || target?.closest('.word-popover')) {
    return
  }
  store.closePopover()
}

onMounted(() => {
  document.addEventListener('click', closePopover)
})

onUnmounted(() => {
  document.removeEventListener('click', closePopover)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="store.wordPopover"
        ref="popoverRef"
        class="word-popover"
        :style="popoverPos"
        @click.stop
      >
        <div class="popover-content">
          <div class="pinyin-header">
            {{ store.wordPopover.showAi ? (store.wordPopover.aiPinyin || store.wordPopover.pinyin) : store.wordPopover.pinyin }}
          </div>

          <div v-if="store.wordPopover.showAi && store.wordPopover.isAiLoading" class="ai-loader">
            <KitSkeleton width="100%" height="16px" />
            <KitSkeleton width="80%" height="16px" />
          </div>

          <div v-else class="popover-body">
            <div
              class="translation"
              v-html="store.wordPopover.showAi ? store.wordPopover.aiTranslation : store.wordPopover.translation"
            />

            <template v-if="store.wordPopover.showAi && store.wordPopover.aiData">
              <div v-if="store.wordPopover.aiData.grammarRules?.length" class="ai-section">
                <div class="ai-subtitle">
                  Грамматика:
                </div>
                <div v-for="(rule, idx) in store.wordPopover.aiData.grammarRules" :key="idx" class="ai-rule">
                  <b>{{ rule.pattern }}</b> — {{ rule.explanation }}
                </div>
              </div>

              <div v-if="store.wordPopover.aiData.vocabulary?.length" class="ai-section">
                <div class="ai-subtitle">
                  Лексика:
                </div>
                <div v-for="(vocab, idx) in store.wordPopover.aiData.vocabulary" :key="idx" class="ai-vocab">
                  <b>{{ vocab.word }}</b> ({{ vocab.pinyin }}) — {{ vocab.meaning }}
                </div>
              </div>
            </template>
          </div>
        </div>

        <div class="popover-footer">
          <div v-if="store.wordPopover.pos" class="pos-badge">
            {{ POS_TAGS_MAP[store.wordPopover.pos] || store.wordPopover.pos }}
          </div>
          <div v-else class="pos-badge-placeholder" />

          <div class="popover-actions">
            <KitBtn
              icon="mdi:robot-outline"
              size="xs"
              variant="text"
              :color="store.wordPopover.showAi ? 'accent' : 'secondary'"
              @click="store.toggleAiTranslation"
            />
            <KitBtn
              icon="mdi:star-outline"
              size="xs"
              variant="text"
              @click="openSaveDialog"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.word-popover {
  position: fixed;
  background-color: rgba(var(--bg-tertiary-color-rgb, 33, 38, 45), 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  z-index: 1000;
  width: 90vw;
  max-width: 450px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 70vh;

  .popover-content {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .pinyin-header {
    background-color: rgba(var(--bg-tertiary-color-rgb, 33, 38, 45), 0.8);
    backdrop-filter: blur(4px);
    text-align: center;
    font-weight: 600;
    font-size: 1.15rem;
    color: var(--fg-accent-color);
    padding: 12px 16px 8px 16px;
    position: sticky;
    top: 0;
    z-index: 2;
  }

  .popover-body {
    padding: 8px;
    position: relative;
  }

  .ai-loader {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .translation {
    font-size: 0.95rem;
    color: var(--fg-primary-color);
    line-height: 1.45;
    text-align: left;
    margin-bottom: 8px;
    word-break: break-word;

    :deep(b) {
      color: var(--fg-primary-color);
      font-weight: 600;
    }
    :deep(.dict-pos) {
      color: var(--fg-success-color);
      font-style: italic;
      font-size: 0.9em;
      margin: 0 2px;
    }
    :deep(.dict-color) {
      color: var(--fg-info-color);
    }
    :deep(.dict-example) {
      display: block;
      color: var(--fg-secondary-color);
      padding-left: 10px;
      margin-top: 4px;
      margin-bottom: 8px;
    }
    :deep(.dict-bullet) {
      display: block;
      margin-top: 6px;
      &::before {
        content: '• ';
        color: var(--fg-accent-color);
        position: absolute;
        font-weight: bold;
      }
    }
    :deep(.dict-margin) {
      margin-left: 12px;
      margin-top: 4px;
    }
    :deep(.dict-ref) {
      color: var(--fg-action-color);
      text-decoration: underline;
      cursor: pointer;
    }
  }

  .ai-section {
    margin-top: 12px;
    border-top: 1px dashed var(--border-secondary-color);
    padding-top: 8px;
    text-align: left;

    .ai-subtitle {
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
      margin-bottom: 4px;
      font-weight: 500;
    }

    .ai-rule,
    .ai-vocab {
      font-size: 0.85rem;
      line-height: 1.4;
      color: var(--fg-primary-color);
      margin-bottom: 6px;

      b {
        color: var(--fg-accent-color);
      }
    }
  }

  .popover-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    background-color: var(--bg-secondary-color);
    border-top: 1px solid var(--border-primary-color);
  }

  .pos-badge {
    font-size: 0.75rem;
    background-color: var(--bg-overlay-secondary-color);
    color: var(--fg-inverted-color);
    padding: 2px 8px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .popover-actions {
    display: flex;
    gap: 4px;
  }
}
</style>
