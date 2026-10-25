<script setup lang="ts">
import type { DifficultyOption, LanguageOption, StyleOption, TopicPreset } from '../../../../shared/constants/presets'
import type { DialogueSettings } from '../../../../shared/types/dialogue'
import type { KitSelectOption } from '~/02.kit'
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitCheckbox, KitDialog, KitInput, KitSelect } from '~/02.kit'
import {
  DIFFICULTY_OPTIONS,
  STYLE_OPTIONS,
  SUPPORTED_PRACTICE_LANGUAGES,
  TOPIC_PRESETS,
} from '../../../../shared/constants/presets'

interface Props {
  visible: boolean
  settings: DialogueSettings
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'start', settings: DialogueSettings): void
}>()

const { t } = useI18n()

const form = ref<DialogueSettings>({
  targetLanguage: 'en',
  difficulty: 'adaptive',
  topic: '',
  style: 'adaptive',
  autoPlayAudio: true,
  autoExpandTranslations: false,
})

const languageOptions = computed<KitSelectOption[]>(() =>
  SUPPORTED_PRACTICE_LANGUAGES.map((lang: LanguageOption) => ({
    label: t(lang.nameKey, lang.fallbackName),
    value: lang.code,
    icon: lang.icon,
  })))
const difficultyOptions = computed<KitSelectOption[]>(() =>
  DIFFICULTY_OPTIONS.map((diff: DifficultyOption) => ({
    label: t(diff.labelKey, diff.fallbackLabel),
    value: diff.value,
  })))
const styleOptions = computed<KitSelectOption[]>(() =>
  STYLE_OPTIONS.map((style: StyleOption) => ({
    label: t(style.labelKey, style.fallbackLabel),
    value: style.value,
    icon: style.icon,
  })))

watch(() => props.settings, (val) => {
  if (val) {
    const targetLanguage = ['en', 'ru', 'zh'].includes(val.targetLanguage) ? val.targetLanguage : 'en'
    form.value = {
      ...val,
      targetLanguage,
      autoExpandTranslations: val.autoExpandTranslations ?? false,
    }
  }
}, { immediate: true, deep: true })

function selectTopicPreset(preset: TopicPreset) {
  form.value.topic = t(preset.titleKey, preset.fallbackTitle)
}
function handleStart() {
  emit('start', { ...form.value })
  emit('update:visible', false)
}
function handleClose() {
  emit('update:visible', false)
}
</script>

<template>
  <KitDialog
    :visible="visible"
    :title="t('plugins.dialogue-trainer.setupTitle')"
    icon="mdi:account-voice"
    :max-width="560"
    :minimizable="false"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="setup-modal-body">
      <p class="setup-intro">
        {{ t('plugins.dialogue-trainer.setupSubtitle') }}
      </p>

      <!-- Language & Difficulty Row -->
      <div class="form-row">
        <div class="form-group flex-1">
          <label class="group-label">
            <Icon icon="mdi:translate" />
            {{ t('plugins.dialogue-trainer.targetLanguage') }}
          </label>
          <KitSelect
            v-model="form.targetLanguage"
            :options="languageOptions"
            size="md"
            class="full-width-select"
          />
        </div>

        <div class="form-group flex-1">
          <label class="group-label">
            <Icon icon="mdi:speedometer" />
            {{ t('plugins.dialogue-trainer.difficultyLevel') }}
          </label>
          <KitSelect
            v-model="form.difficulty"
            :options="difficultyOptions"
            size="md"
            class="full-width-select"
          />
        </div>
      </div>

      <!-- Communication Style -->
      <div class="form-group">
        <label class="group-label">
          <Icon icon="mdi:emoticon-outline" />
          {{ t('plugins.dialogue-trainer.style') }}
        </label>
        <KitSelect
          v-model="form.style"
          :options="styleOptions"
          size="md"
          class="full-width-select"
        />
      </div>

      <!-- Free Topic Input -->
      <div class="form-group">
        <label class="group-label">
          <Icon icon="mdi:chat-question-outline" />
          {{ t('plugins.dialogue-trainer.topic') }}
        </label>
        <KitInput
          v-model="form.topic"
          :placeholder="t('plugins.dialogue-trainer.topicPlaceholder')"
          size="md"
          clearable
        />
      </div>

      <!-- Suggested Topic Chips -->
      <div class="form-group">
        <span class="chips-label">{{ t('plugins.dialogue-trainer.suggestedTopics') }}:</span>
        <div class="topic-chips">
          <button
            v-for="preset in TOPIC_PRESETS"
            :key="preset.id"
            type="button"
            class="topic-chip"
            :class="{ active: form.topic === t(preset.titleKey, preset.fallbackTitle) }"
            @click="selectTopicPreset(preset)"
          >
            <Icon :icon="preset.icon" />
            <span>{{ t(preset.titleKey, preset.fallbackTitle) }}</span>
          </button>
        </div>
      </div>

      <!-- Auto Play Toggle -->
      <div class="form-group checkbox-row">
        <label class="checkbox-label">
          <KitCheckbox v-model="form.autoPlayAudio" />
          <span>{{ t('plugins.dialogue-trainer.autoPlayAudio') }}</span>
        </label>
      </div>

      <!-- Auto Expand Translations Toggle -->
      <div class="form-group checkbox-row">
        <label class="checkbox-label">
          <KitCheckbox v-model="form.autoExpandTranslations" />
          <span>{{ t('plugins.dialogue-trainer.autoExpandTranslations') }}</span>
        </label>
      </div>

      <!-- Actions -->
      <div class="setup-actions">
        <KitBtn variant="tonal" @click="handleClose">
          {{ t('plugins.dialogue-trainer.cancel') }}
        </KitBtn>
        <KitBtn
          color="primary"
          variant="solid"
          icon="mdi:play"
          @click="handleStart"
        >
          {{ t('plugins.dialogue-trainer.startDialogue') }}
        </KitBtn>
      </div>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.setup-modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 10px;
}

.setup-intro {
  margin: 0;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  line-height: 1.45;
}

.form-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;

  @media (max-width: 540px) {
    flex-direction: column;
    gap: 14px;
  }
}

.flex-1 {
  flex: 1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-primary-color);
}

.full-width-select {
  width: 100%;
}

.chips-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
}

.topic-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}

.topic-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.82rem;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-primary-color);
  }

  &.active {
    background: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    color: #fff;
  }
}

.checkbox-row {
  margin-top: 4px;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  color: var(--fg-primary-color);
  cursor: pointer;
}

.setup-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--border-secondary-color);
}
</style>
