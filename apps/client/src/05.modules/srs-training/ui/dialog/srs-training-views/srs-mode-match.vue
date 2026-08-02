<script setup lang="ts">
import type { UserDictItem } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { useTts } from '~/01.shared/composables/use-tts'
import { useTrainingStore } from '../../../store/training.store'
import SrsCardToolbar from '../../partials/srs-card-toolbar.vue'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<Props>()
const emit = defineEmits(['grade'])

interface Props {
  card: UserDictItem
  currentIndex: number
}

const trainingStore = useTrainingStore()
const { speak } = useTts()

const leftItems = ref<UserDictItem[]>([])
const rightItems = ref<UserDictItem[]>([])

const selectedLeft = ref<UserDictItem | null>(null)
const selectedRight = ref<UserDictItem | null>(null)
const matchedIds = ref<Set<number>>(new Set())
const wrongPair = ref<{ leftId: number, rightId: number } | null>(null)
const currentChunkEndIndex = ref(0)
const matchedCard = ref<UserDictItem | null>(null)

function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

function loadChunk(startIndex: number) {
  const chunk = trainingStore.reviewQueue.slice(startIndex, startIndex + 5)
  if (chunk.length === 0)
    return

  currentChunkEndIndex.value = startIndex + chunk.length
  matchedIds.value.clear()

  leftItems.value = shuffle(chunk)
  rightItems.value = shuffle(chunk)
}

watch(() => props.currentIndex, (idx) => {
  if (idx >= currentChunkEndIndex.value)
    loadChunk(idx)
}, { immediate: true })

function selectLeft(item: UserDictItem) {
  if (matchedIds.value.has(item.id))
    return
  selectedLeft.value = item
  checkMatch()
}

function selectRight(item: UserDictItem) {
  if (matchedIds.value.has(item.id))
    return
  selectedRight.value = item
  checkMatch()
}

function checkMatch() {
  if (selectedLeft.value && selectedRight.value) {
    if (selectedLeft.value.id === selectedRight.value.id) {
      const matchId = selectedLeft.value.id
      const mCard = selectedLeft.value

      matchedIds.value.add(matchId)
      selectedLeft.value = null
      selectedRight.value = null

      matchedCard.value = mCard
      if (mCard.word)
        speak(mCard.word, mCard.language)
    }
    else {
      wrongPair.value = { leftId: selectedLeft.value.id, rightId: selectedRight.value.id }
      setTimeout(() => {
        wrongPair.value = null
      }, 600)
      selectedLeft.value = null
      selectedRight.value = null
    }
  }
}

function dismissMatchedCard() {
  matchedCard.value = null
  setTimeout(() => {
    emit('grade', 3)
  }, 100)
}
</script>

<template>
  <div class="match-mode-container">
    <div class="match-columns">
      <div class="match-col left-col">
        <button
          v-for="item in leftItems"
          :key="`left-${item.id}`"
          class="match-item"
          :class="{
            'is-selected': selectedLeft?.id === item.id,
            'is-matched': matchedIds.has(item.id),
            'is-wrong': wrongPair?.leftId === item.id,
          }"
          @click="selectLeft(item)"
        >
          <span class="item-text">{{ item.word }}</span>
        </button>
      </div>
      <div class="match-col right-col">
        <button
          v-for="item in rightItems"
          :key="`right-${item.id}`"
          class="match-item"
          :class="{
            'is-selected': selectedRight?.id === item.id,
            'is-matched': matchedIds.has(item.id),
            'is-wrong': wrongPair?.rightId === item.id,
          }"
          @click="selectRight(item)"
        >
          <span class="item-text">{{ item.translation }}</span>
        </button>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="matchedCard" class="matched-overlay" @click="dismissMatchedCard">
        <div class="matched-card" @click.stop="dismissMatchedCard">
          <div class="word-huge">
            {{ matchedCard.word }}
          </div>
          <div v-if="matchedCard.transcription" class="transcription-badge">
            {{ matchedCard.transcription }}
          </div>
          <div class="translation-box" v-html="matchedCard.translation" />

          <div v-if="matchedCard.encounters?.[0]?.sentence" class="original-sentence">
            <Icon icon="mdi:format-quote-close" class="quote-icon" />
            <span>{{ matchedCard.encounters[0].sentence }}</span>
          </div>

          <SrsCardToolbar :card="matchedCard" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.match-mode-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 16px 12px;
  height: 100%;
  justify-content: center;
  position: relative;
}

.match-columns {
  display: flex;
  gap: 16px;
  flex: 1;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;

  @include media-down(sm) {
    gap: 8px;
  }
}

.match-col {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 12px;
  justify-content: center;

  @include media-down(sm) {
    gap: 8px;
  }
}

.match-item {
  background: var(--bg-primary-color);
  border: 2px solid var(--border-secondary-color);
  border-radius: 16px;
  padding: 12px;
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--fg-primary-color);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 80px;
  position: relative;
  overflow: hidden;
  will-change: transform, border-color, background, opacity;
  user-select: none;
  -webkit-tap-highlight-color: transparent;

  @include media-down(sm) {
    font-size: 0.95rem;
    min-height: 70px;
    padding: 8px;
    border-radius: 12px;
  }

  .item-text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    pointer-events: none;
    word-break: break-word;
  }

  &:hover {
    @media (hover: hover) {
      border-color: var(--border-primary-color);
      background: var(--bg-hover-color);
    }
  }

  &:active {
    transform: scale(0.96);
  }

  &.is-selected {
    border-color: var(--fg-accent-color);
    background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.1);
    transform: scale(1.02);
    box-shadow: 0 4px 16px rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.15);
  }

  &.is-matched {
    border-color: var(--fg-success-color);
    background: rgba(var(--fg-success-color-rgb, 46, 204, 113), 0.1);
    color: var(--fg-success-color);
    transform: scale(0.9);
    opacity: 0;
    pointer-events: none;
    transition: all 0.4s ease-out;
  }

  &.is-wrong {
    border-color: var(--fg-error-color);
    background: rgba(var(--fg-error-color-rgb, 231, 76, 60), 0.1);
    animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }
}

@keyframes shake {
  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }
  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }
  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }
  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}

.matched-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  cursor: pointer;
}

.matched-card {
  background: var(--bg-primary-color);
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  max-width: 500px;
  width: 90%;
  text-align: center;
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;

  .word-huge {
    font-size: 3rem;
    font-weight: bold;
    color: var(--fg-primary-color);
  }

  .transcription-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 12px;
    background-color: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
    border-radius: 8px;
    font-size: 1.1rem;
    font-weight: 500;
    font-family: 'Maple Mono CN', 'Courier New', monospace;
  }

  .translation-box {
    background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.1);
    border-left: 4px solid var(--fg-accent-color);
    padding: 12px 16px;
    border-radius: 4px 8px 8px 4px;
    font-size: 1.15rem;
    line-height: 1.5;
    color: var(--fg-primary-color);
    text-align: left;
    width: 100%;
  }

  .original-sentence {
    display: flex;
    gap: 12px;
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    padding: 12px 16px;
    border-radius: 8px;
    text-align: left;
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    line-height: 1.5;
    width: 100%;

    .quote-icon {
      font-size: 1.5rem;
      color: var(--fg-muted-color);
      flex-shrink: 0;
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
