<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn, KitSkeleton } from '~/components/01.kit'
import { useTts } from '~/shared/composables/use-tts'
import { POS_TAGS_MAP } from '~/shared/constants/pos-tags'
import { useBooksStore } from '~/shared/store/books.store'

const store = useBooksStore()
const { speak, isPlaying, isLoading } = useTts()

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

function playWordTTS() {
  if (store.wordPopover) {
    speak(store.wordPopover.word)
  }
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
          <div class="transcription-header">
            <span class="header-text">
              {{ store.wordPopover.showAi ? (store.wordPopover.aiTranscription || store.wordPopover.transcription) : store.wordPopover.transcription }}
            </span>
            <button class="close-btn" @click.stop="store.closePopover()">
              <Icon width="16" height="16" icon="mdi:chevron-down" />
            </button>
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
                  <b>{{ vocab.word }}</b> ({{ vocab.transcription }}) — {{ vocab.meaning }}
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
              :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
              size="xs"
              variant="text"
              color="primary"
              :class="{ 'pulse-animation': isPlaying, 'spin-animation': isLoading }"
              @click.stop="playWordTTS"
            />

            <KitBtn
              icon="mdi:robot-outline"
              size="xs"
              variant="text"
              :color="store.wordPopover.showAi ? 'accent' : 'secondary'"
              @click.stop="store.toggleAiTranslation"
            />

            <KitBtn
              icon="mdi:star-outline"
              size="xs"
              variant="text"
              @click.stop="openSaveDialog"
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

  .transcription-header {
    background-color: rgba(var(--bg-tertiary-color-rgb, 33, 38, 45), 0.8);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 16px 8px 16px;
    position: sticky;
    top: 0;
    z-index: 2;

    .header-text {
      font-weight: 600;
      font-size: 1.15rem;
      color: var(--fg-accent-color);
      text-align: center;
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
        font-size: 1.4rem; // Немного увеличим для chevron
      }
    }
  }

  .popover-body {
    padding: 8px 12px;
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
    white-space: pre-wrap;
    display: flex;
    flex-direction: column;
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

  .pulse-animation {
    :deep(.kit-btn-icon) {
      animation: pulse-op 1.5s infinite;
      color: var(--fg-accent-color);
    }
  }

  .spin-animation {
    :deep(.kit-btn-icon) {
      animation: spin 1s linear infinite;
    }
  }
}

@keyframes pulse-op {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
