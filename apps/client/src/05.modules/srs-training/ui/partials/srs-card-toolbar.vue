<script setup lang="ts">
import type { UserDictItem } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, nextTick, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRepos } from '~/00.plugins/di'
import { useToast } from '~/01.shared/composables/use-toast'
import { useTts } from '~/01.shared/composables/use-tts'
import { vLongPress } from '~/01.shared/directives/long-press'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { KitBtn, KitDropdown, KitTooltip } from '~/02.kit/index.ts'
import { PronunciationCheck } from '~/04.features/pronunciation-check'

interface Props {
  card: UserDictItem
}

const props = defineProps<Props>()

const AiExamplesModal = lazyComponent(() => import('~/04.features/analysis/ui/modal/ai-examples-modal.vue'))
const LlmChatModal = lazyComponent(() => import('~/04.features/llm-chat/ui/llm-chat-modal.vue'))
const HanziBoard = lazyComponent(() => import('~/05.modules/dictionary/ui/hanzi-board.vue'))

const repos = useRepos()
const { speak, isPlaying, isLoading } = useTts()
const toast = useToast()
const { t } = useI18n()
const authStore = useAuthStore()

const isAdmin = computed(() => authStore.user?.role === 'admin')
const isTtsPopoverOpen = ref(false)

const showAnimation = ref(false)
const hanziBoardRef = ref<{ replay: () => void } | null>(null)

const isAiModalOpen = ref(false)
const isChatModalOpen = ref(false)
const isAiLoading = ref(false)
const aiData = ref<unknown | null>(null)

const expandedSections = reactive<Record<string, boolean>>({
  grammar: false,
  vocab: false,
  notes: false,
})

function openTtsPopover() {
  if (isAdmin.value)
    isTtsPopoverOpen.value = true
}

function playTTS(forceCacheBypass = false) {
  if (props.card.word) {
    speak(
      props.card.word,
      props.card.language,
      undefined,
      forceCacheBypass,
    )
  }
}

async function fetchAiExamples() {
  if (!props.card.word)
    return
  isAiModalOpen.value = true
  isAiLoading.value = true
  aiData.value = null

  try {
    const res = await repos.dictionary.generateExamples(props.card.word, props.card.language || 'en')
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

function toggleAnimation() {
  showAnimation.value = !showAnimation.value
  if (showAnimation.value)
    nextTick(() => hanziBoardRef.value?.replay())
}
</script>

<template>
  <div class="card-toolbar fade-in" @click.stop>
    <div class="toolbar-group">
      <KitDropdown
        v-model="isTtsPopoverOpen"
        placement="bottom-start"
        width="220px"
        :disabled="true"
      >
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
            <Icon icon="mdi:refresh" /> {{ t('dictWord.forceNewVoiceover') }}
          </button>
        </div>
      </KitDropdown>

      <PronunciationCheck
        :word="card.word"
        :language="card.language"
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
            <Icon icon="mdi:text-box-search-outline" /> {{ t('analysis.aiContextAndExamples') }}
          </button>
          <button class="dropdown-item" @click="isChatModalOpen = true">
            <Icon icon="mdi:chat-processing-outline" /> {{ t('dictionary.aiFreeQuestion') }}
          </button>
        </div>
      </KitDropdown>

      <KitTooltip v-if="card.language === 'zh' && /[\u4E00-\u9FA5]/.test(card.word)" :text="t('dictionary.writingPractice')" placement="bottom">
        <KitBtn
          icon="mdi:draw"
          variant="tonal"
          color="secondary"
          size="sm"
          :class="{ 'is-active-btn': showAnimation }"
          @click="toggleAnimation"
        />
      </KitTooltip>
    </div>

    <div v-if="card.grammarNote || card.vocabularyNote || card.notes" class="toolbar-divider" />
    <div v-if="card.grammarNote || card.vocabularyNote || card.notes" class="toolbar-group">
      <KitTooltip v-if="card.grammarNote" :text="t('dictionary.grammar')" placement="bottom">
        <KitBtn
          size="sm"
          :variant="expandedSections.grammar ? 'solid' : 'tonal'"
          :color="expandedSections.grammar ? 'primary' : 'secondary'"
          icon="mdi:puzzle-outline"
          @click="toggleSection('grammar')"
        />
      </KitTooltip>
      <KitTooltip v-if="card.vocabularyNote" :text="t('dictionary.vocabulary')" placement="bottom">
        <KitBtn
          size="sm"
          :variant="expandedSections.vocab ? 'solid' : 'tonal'"
          :color="expandedSections.vocab ? 'primary' : 'secondary'"
          icon="mdi:book-open-page-variant-outline"
          @click="toggleSection('vocab')"
        />
      </KitTooltip>
      <KitTooltip v-if="card.notes" :text="t('dictionary.notesMnemonic')" placement="bottom">
        <KitBtn
          size="sm"
          :variant="expandedSections.notes ? 'solid' : 'tonal'"
          :color="expandedSections.notes ? 'primary' : 'secondary'"
          icon="mdi:note-text-outline"
          @click="toggleSection('notes')"
        />
      </KitTooltip>
    </div>
  </div>

  <div v-if="expandedSections.grammar && card.grammarNote" class="word-notes fade-in">
    <div class="notes-label">
      <Icon icon="mdi:puzzle-outline" /> {{ t('dictionary.grammar') }}
    </div>
    <div class="notes-text" v-html="card.grammarNote" />
  </div>
  <div v-if="expandedSections.vocab && card.vocabularyNote" class="word-notes fade-in">
    <div class="notes-label">
      <Icon icon="mdi:book-open-page-variant-outline" /> {{ t('dictionary.vocabulary') }}
    </div>
    <div class="notes-text" v-html="card.vocabularyNote" />
  </div>
  <div v-if="expandedSections.notes && card.notes" class="word-notes fade-in">
    <div class="notes-label">
      <Icon icon="mdi:note-text-outline" /> {{ t('dictionary.notesMnemonic') }}
    </div>
    <div class="notes-text" v-html="card.notes" />
  </div>

  <div v-if="showAnimation" class="animation-container fade-in">
    <h4>{{ t('dictionary.strokeOrder') }}</h4>
    <HanziBoard
      ref="hanziBoardRef"
      :text="card.word"
      mode="animation"
      :size="80"
    />
    <KitBtn
      icon="mdi:replay"
      variant="text"
      size="xs"
      color="secondary"
      @click="hanziBoardRef?.replay()"
    >
      {{ t('dictionary.repeat') }}
    </KitBtn>
  </div>

  <AiExamplesModal v-model:visible="isAiModalOpen" :loading="isAiLoading" :data="aiData" />
  <LlmChatModal v-model:visible="isChatModalOpen" :word="card.word" :language="card.language || 'en'" />
</template>

<style lang="scss" scoped>
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
}
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
  margin-top: 8px;
}
.notes-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--fg-accent-color);
  margin-bottom: 8px;
  text-transform: uppercase;
  font-size: 0.85rem;
  letter-spacing: 0.5px;
}
.notes-text {
  color: var(--fg-primary-color);
  white-space: pre-wrap;
}
.animation-container {
  background-color: rgba(var(--bg-tertiary-color-rgb), 0.5);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-secondary-color);
  margin-top: 8px;
  h4 {
    margin: 0 0 8px 0;
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    text-transform: uppercase;
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
}
.fade-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.is-playing-pulse :deep(.kit-btn-icon) {
  animation: pulse-op 1.2s infinite;
  color: var(--fg-error-color) !important;
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
.is-active-btn {
  color: var(--fg-accent-color) !important;
  background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.1) !important;
}
</style>
