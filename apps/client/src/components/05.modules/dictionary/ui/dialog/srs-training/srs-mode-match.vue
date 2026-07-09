<script setup lang="ts">
import type { UserDictItem } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDropdown, KitTooltip } from '~/components/01.kit'
import { PronunciationCheck } from '~/components/04.features/pronunciation-check'
import { useToast } from '~/shared/composables/use-toast'
import { useTts } from '~/shared/composables/use-tts'
import { vLongPress } from '~/shared/directives/long-press'
import { api } from '~/shared/services/api.service'
import { useAuthStore } from '~/shared/store/auth.store'
import { useDictionaryStore } from '../../../store/dictionary.store'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  card: UserDictItem
  currentIndex: number
}>()

const emit = defineEmits(['grade'])

const AiExamplesModal = lazyComponent(() => import('~/components/03.domain/analysis/ui/modal/ai-examples-modal.vue'))
const LlmChatModal = lazyComponent(() => import('~/components/04.features/llm-chat/ui/llm-chat-modal.vue'))
const HanziBoard = lazyComponent(() => import('../../hanzi-board.vue'))

const dictStore = useDictionaryStore()
const { speak, isPlaying, isLoading } = useTts()
const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()

const isAdmin = computed(() => authStore.user?.role === 'admin')
const isTtsPopoverOpen = ref(false)

const expandedSections = reactive<Record<string, boolean>>({
  grammar: false,
  vocab: false,
  notes: false,
})

const isAiModalOpen = ref(false)
const isChatModalOpen = ref(false)
const isAiLoading = ref(false)
const aiData = ref<any>(null)

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
  const chunk = dictStore.reviewQueue.slice(startIndex, startIndex + 5)
  if (chunk.length === 0)
    return

  currentChunkEndIndex.value = startIndex + chunk.length
  matchedIds.value.clear()

  leftItems.value = shuffle(chunk)
  rightItems.value = shuffle(chunk)
}

watch(() => props.currentIndex, (idx) => {
  if (idx >= currentChunkEndIndex.value) {
    loadChunk(idx)
  }
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
      if (mCard.word) {
        speak(mCard.word, mCard.language)
      }
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

const showAnimation = ref(false)
const hanziBoardRef = ref<any>(null)

function dismissMatchedCard() {
  matchedCard.value = null
  expandedSections.grammar = false
  expandedSections.vocab = false
  expandedSections.notes = false
  showAnimation.value = false
  setTimeout(() => {
    emit('grade', 3) // Advance progress
  }, 100) // Slight delay to allow animation to start smoothly
}

function toggleAnimation() {
  showAnimation.value = !showAnimation.value
  if (showAnimation.value) {
    nextTick(() => {
      hanziBoardRef.value?.replay()
    })
  }
}

function openTtsPopover() {
  if (isAdmin.value) {
    isTtsPopoverOpen.value = true
  }
}

function playTTS(forceCacheBypass = false) {
  if (matchedCard.value?.word) {
    speak(matchedCard.value.word, matchedCard.value.language, undefined, forceCacheBypass)
  }
}

async function fetchAiExamples() {
  if (!matchedCard.value?.word)
    return

  isAiModalOpen.value = true
  isAiLoading.value = true
  aiData.value = null

  try {
    const res = await api.dictionary.generateExamples(matchedCard.value.word, matchedCard.value.language || 'en')
    aiData.value = res
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : t('dictionary.errorExamples'))
    isAiModalOpen.value = false
  }
  finally {
    isAiLoading.value = false
  }
}

function toggleSection(sec: 'grammar' | 'vocab' | 'notes') {
  expandedSections[sec] = !expandedSections[sec]
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

          <div class="card-toolbar fade-in" @click.stop>
            <div class="toolbar-group">
              <KitDropdown v-model="isTtsPopoverOpen" placement="bottom-start" width="220px" :disabled="true">
                <template #activator>
                  <KitTooltip :text="t('dictionary.listenVoice')" placement="bottom">
                    <KitBtn
                      v-long-press="openTtsPopover"
                      :icon="isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium'"
                      :loading="isLoading"
                      variant="tonal"
                      color="secondary"
                      size="sm"
                      :class="{ 'is-playing-pulse': isPlaying, 'is-active-btn': isTtsPopoverOpen }"
                      @click="playTTS(false)"
                      @contextmenu.prevent="openTtsPopover"
                    />
                  </KitTooltip>
                </template>
                <div class="dropdown-menu-list">
                  <button class="dropdown-item" @click="playTTS(true); isTtsPopoverOpen = false">
                    <Icon icon="mdi:refresh" />
                    {{ t('dictWord.forceNewVoiceover') }}
                  </button>
                </div>
              </KitDropdown>

              <PronunciationCheck
                v-if="matchedCard"
                :word="matchedCard.word"
                :language="matchedCard.language"
                variant="button"
                btn-size="sm"
                btn-color="secondary"
                btn-variant="tonal"
                tooltip-placement="bottom"
              />

              <KitDropdown placement="bottom-start" width="240px">
                <template #activator="{ props: dropdownProps }">
                  <KitTooltip :text="t('dictionary.aiHint')" placement="bottom">
                    <KitBtn
                      icon="mdi:robot-outline"
                      variant="tonal"
                      color="secondary"
                      size="sm"
                      :class="{ 'is-active-btn': dropdownProps.isOpen }"
                    />
                  </KitTooltip>
                </template>
                <div class="dropdown-menu-list">
                  <button class="dropdown-item" @click="fetchAiExamples">
                    <Icon icon="mdi:text-box-search-outline" />
                    {{ t('analysis.aiContextAndExamples') }}
                  </button>
                  <button class="dropdown-item" @click="isChatModalOpen = true">
                    <Icon icon="mdi:chat-processing-outline" />
                    {{ t('dictionary.aiFreeQuestion') }}
                  </button>
                </div>
              </KitDropdown>
              <KitTooltip v-if="matchedCard.language === 'zh' && /[\u4E00-\u9FA5]/.test(matchedCard.word)" :text="t('dictionary.writingPractice')" placement="bottom">
                <KitBtn icon="mdi:draw" variant="tonal" color="secondary" size="sm" :class="{ 'is-active-btn': showAnimation }" @click="toggleAnimation" />
              </KitTooltip>
            </div>

            <div v-if="matchedCard.grammarNote || matchedCard.vocabularyNote || matchedCard.notes" class="toolbar-divider" />
            <div v-if="matchedCard.grammarNote || matchedCard.vocabularyNote || matchedCard.notes" class="toolbar-group">
              <KitTooltip v-if="matchedCard.grammarNote" :text="t('dictionary.grammar')" placement="bottom">
                <KitBtn size="sm" :variant="expandedSections.grammar ? 'solid' : 'tonal'" :color="expandedSections.grammar ? 'primary' : 'secondary'" icon="mdi:puzzle-outline" @click="toggleSection('grammar')" />
              </KitTooltip>
              <KitTooltip v-if="matchedCard.vocabularyNote" :text="t('dictionary.vocabulary')" placement="bottom">
                <KitBtn size="sm" :variant="expandedSections.vocab ? 'solid' : 'tonal'" :color="expandedSections.vocab ? 'primary' : 'secondary'" icon="mdi:book-open-page-variant-outline" @click="toggleSection('vocab')" />
              </KitTooltip>
              <KitTooltip v-if="matchedCard.notes" :text="t('dictionary.notesMnemonic')" placement="bottom">
                <KitBtn size="sm" :variant="expandedSections.notes ? 'solid' : 'tonal'" :color="expandedSections.notes ? 'primary' : 'secondary'" icon="mdi:note-text-outline" @click="toggleSection('notes')" />
              </KitTooltip>
            </div>
          </div>

          <div v-if="expandedSections.grammar && matchedCard.grammarNote" class="word-notes fade-in">
            <div class="notes-label">
              <Icon icon="mdi:puzzle-outline" /> {{ t('dictionary.grammar') }}
            </div>
            <div class="notes-text" v-html="matchedCard.grammarNote" />
          </div>
          <div v-if="expandedSections.vocab && matchedCard.vocabularyNote" class="word-notes fade-in">
            <div class="notes-label">
              <Icon icon="mdi:book-open-page-variant-outline" /> {{ t('dictionary.vocabulary') }}
            </div>
            <div class="notes-text" v-html="matchedCard.vocabularyNote" />
          </div>
          <div v-if="expandedSections.notes && matchedCard.notes" class="word-notes fade-in">
            <div class="notes-label">
              <Icon icon="mdi:note-text-outline" /> {{ t('dictionary.notesMnemonic') }}
            </div>
            <div class="notes-text" v-html="matchedCard.notes" />
          </div>

          <div v-if="showAnimation" class="animation-container fade-in">
            <h4>{{ t('dictionary.strokeOrder') }}</h4>
            <HanziBoard ref="hanziBoardRef" :text="matchedCard.word" mode="animation" :size="80" />
            <KitBtn icon="mdi:replay" variant="text" size="xs" color="secondary" @click="hanziBoardRef?.replay()">
              {{ t('dictionary.repeat') }}
            </KitBtn>
          </div>
        </div>
      </div>
    </Transition>

    <AiExamplesModal v-model:visible="isAiModalOpen" :loading="isAiLoading" :data="aiData" />
    <LlmChatModal v-if="matchedCard" v-model:visible="isChatModalOpen" :word="matchedCard.word" :language="matchedCard.language || 'en'" />
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

.card-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  background-color: var(--bg-secondary-color);
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  width: 100%;

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toolbar-divider {
    width: 1px;
    height: 24px;
    background-color: var(--border-secondary-color);
  }
}

.word-notes {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  padding: 12px 16px;
  border-radius: 8px;
  text-align: left;
  font-size: 0.95rem;
  color: var(--fg-secondary-color);
  line-height: 1.5;
  width: 100%;

  .notes-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin-bottom: 8px;

    svg {
      color: var(--fg-accent-color);
    }
  }

  .notes-text {
    :deep(p) {
      margin: 0;
      &:not(:last-child) {
        margin-bottom: 8px;
      }
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

.is-playing-pulse {
  :deep(.kit-btn-icon) {
    animation: pulse-op 1.2s infinite;
    color: var(--fg-error-color) !important;
  }
}

@keyframes pulse-op {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
  }
}

.dropdown-menu-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--fg-primary-color);
  font-size: 0.95rem;
  font-family: inherit;
  cursor: pointer;
  border-radius: 6px;
  transition:
    background-color 0.2s,
    color 0.2s;
  text-align: left;
  width: 100%;

  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    font-size: 1.25rem;
    color: var(--fg-secondary-color);
    flex-shrink: 0;
  }

  &:hover:not(:disabled) svg {
    color: var(--fg-accent-color);
  }
}

.animation-container {
  background-color: rgba(var(--bg-tertiary-color-rgb), 0.5);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-secondary-color);
  width: 100%;

  h4 {
    margin: 0 0 8px 0;
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    text-transform: uppercase;
  }
}

.is-active-btn {
  color: var(--fg-accent-color) !important;
  background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.1) !important;
}
</style>
