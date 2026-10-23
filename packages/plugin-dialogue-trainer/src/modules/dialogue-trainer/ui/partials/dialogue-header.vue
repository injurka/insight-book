<script setup lang="ts">
import type { DialogueSettings } from '../../../../shared/types/dialogue'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitTooltip } from '~/02.kit'
import {
  DIFFICULTY_OPTIONS,
  STYLE_OPTIONS,
  SUPPORTED_PRACTICE_LANGUAGES,
} from '../../../../shared/constants/presets'

interface Props {
  settings: DialogueSettings
  hasMessages: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'openSettings'): void
  (e: 'openHistory'): void
  (e: 'newDialogue'): void
  (e: 'deleteDialogue'): void
}>()

const { t } = useI18n()
const router = useRouter()

const targetLanguageName = computed(() => {
  const found = SUPPORTED_PRACTICE_LANGUAGES.find(l => l.code === props.settings.targetLanguage)

  return found ? t(found.nameKey, found.fallbackName) : props.settings.targetLanguage.toUpperCase()
})

const difficultyName = computed(() => {
  const found = DIFFICULTY_OPTIONS.find(d => d.value === props.settings.difficulty)

  return found ? t(found.labelKey, found.fallbackLabel) : props.settings.difficulty
})

const styleName = computed(() => {
  const found = STYLE_OPTIONS.find(s => s.value === props.settings.style)

  return found ? t(found.labelKey, found.fallbackLabel) : props.settings.style
})
</script>

<template>
  <header class="dialogue-header">
    <div class="header-left">
      <KitBtn
        icon="mdi:arrow-left"
        variant="text"
        :aria-label="t('plugins.dialogue-trainer.cancel')"
        class="back-btn"
        @click="router.back()"
      />

      <div class="header-titles">
        <h1 class="header-title">
          <Icon icon="mdi:account-voice" class="title-icon" />
          {{ t('plugins.dialogue-trainer.pageTitle') }}
        </h1>
        <p class="header-subtitle">
          {{ settings.topic || t('plugins.dialogue-trainer.pageSubtitle') }}
        </p>
      </div>
    </div>

    <!-- Active Settings Tags -->
    <div class="header-center">
      <div class="param-tags" @click="emit('openSettings')">
        <span class="param-tag">
          <Icon icon="mdi:translate" />
          {{ targetLanguageName }}
        </span>
        <span class="param-tag">
          <Icon icon="mdi:speedometer" />
          {{ difficultyName }}
        </span>
        <span class="param-tag">
          <Icon icon="mdi:emoticon-outline" />
          {{ styleName }}
        </span>
      </div>
    </div>

    <!-- Header Actions -->
    <div class="header-right">
      <KitTooltip :text="t('plugins.dialogue-trainer.setupTitle')">
        <KitBtn
          icon="mdi:tune"
          variant="tonal"
          size="sm"
          :aria-label="t('plugins.dialogue-trainer.setupTitle')"
          @click="emit('openSettings')"
        />
      </KitTooltip>

      <KitTooltip :text="t('plugins.dialogue-trainer.history')">
        <KitBtn
          icon="mdi:history"
          variant="tonal"
          size="sm"
          :aria-label="t('plugins.dialogue-trainer.history')"
          @click="emit('openHistory')"
        />
      </KitTooltip>

      <KitTooltip :text="t('plugins.dialogue-trainer.newDialogue')">
        <KitBtn
          icon="mdi:plus"
          variant="solid"
          color="primary"
          size="sm"
          :aria-label="t('plugins.dialogue-trainer.newDialogue')"
          @click="emit('newDialogue')"
        />
      </KitTooltip>

      <KitTooltip v-if="hasMessages" :text="t('plugins.dialogue-trainer.deleteSession')">
        <KitBtn
          icon="mdi:delete-outline"
          variant="text"
          color="error"
          size="sm"
          :aria-label="t('plugins.dialogue-trainer.deleteSession')"
          @click="emit('deleteDialogue')"
        />
      </KitTooltip>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.dialogue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: calc(12px + var(--safe-area-top, env(safe-area-inset-top, 0px))) max(20px, env(safe-area-inset-right, 0px))
    12px max(20px, env(safe-area-inset-left, 0px));
  border-bottom: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  flex-wrap: wrap;

  @media (max-width: 768px) {
    padding: calc(10px + var(--safe-area-top, env(safe-area-inset-top, 0px))) max(14px, env(safe-area-inset-right, 0px))
      10px max(14px, env(safe-area-inset-left, 0px));
    gap: 10px;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.header-titles {
  min-width: 0;
}

.header-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--fg-primary-color);
  display: flex;
  align-items: center;
  gap: 8px;

  .title-icon {
    color: var(--fg-accent-color);
    font-size: 1.3rem;
  }
}

.header-subtitle {
  margin: 2px 0 0;
  font-size: 0.82rem;
  color: var(--fg-secondary-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.header-center {
  display: flex;
  align-items: center;

  @media (max-width: 900px) {
    display: none;
  }
}

.param-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 20px;
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
  }
}

.param-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--fg-secondary-color);
  padding: 2px 6px;
  border-radius: 12px;

  &:hover {
    color: var(--fg-primary-color);
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
