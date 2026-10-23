<script setup lang="ts">
import type { DialogueSettings } from '../../../../shared/types/dialogue'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitDropdown } from '~/02.kit'
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
          <span class="title-text">{{ t('plugins.dialogue-trainer.pageTitle') }}</span>
        </h1>

        <!-- Mobile & Compact Subtitle (Clickable parameters) -->
        <div class="header-subtitle-row" @click="emit('openSettings')">
          <span class="sub-badge">{{ targetLanguageName }}</span>
          <span class="sub-sep">·</span>
          <span class="sub-topic">{{ settings.topic || difficultyName }}</span>
        </div>
      </div>
    </div>

    <!-- Active Settings Tags (Desktop >= 900px) -->
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

    <!-- Header Actions (Compact Three-dots Popover Menu) -->
    <div class="header-right">
      <KitDropdown placement="bottom-end" width="220px">
        <template #activator="{ props: activatorProps }">
          <KitBtn
            icon="mdi:dots-vertical"
            variant="text"
            size="sm"
            class="header-more-btn"
            :class="{ 'is-active-btn': activatorProps?.isOpen }"
            :aria-label="t('plugins.dialogue-trainer.actions', 'Действия')"
          />
        </template>

        <div class="header-menu-list">
          <button type="button" class="header-menu-item" @click="emit('newDialogue')">
            <Icon icon="mdi:plus" class="item-icon new-icon" />
            <span class="item-label">{{ t('plugins.dialogue-trainer.newDialogue') }}</span>
          </button>

          <button type="button" class="header-menu-item" @click="emit('openSettings')">
            <Icon icon="mdi:tune" class="item-icon" />
            <span class="item-label">{{ t('plugins.dialogue-trainer.setupTitle') }}</span>
          </button>

          <button type="button" class="header-menu-item" @click="emit('openHistory')">
            <Icon icon="mdi:history" class="item-icon" />
            <span class="item-label">{{ t('plugins.dialogue-trainer.history') }}</span>
          </button>

          <div v-if="hasMessages" class="header-menu-divider" />

          <button
            v-if="hasMessages"
            type="button"
            class="header-menu-item is-danger"
            @click="emit('deleteDialogue')"
          >
            <Icon icon="mdi:delete-outline" class="item-icon" />
            <span class="item-label">{{ t('plugins.dialogue-trainer.deleteSession') }}</span>
          </button>
        </div>
      </KitDropdown>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.dialogue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: calc(56px + var(--safe-area-top, env(safe-area-inset-top, 0px)));
  box-sizing: border-box;
  padding: var(--safe-area-top, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) 0
    max(16px, env(safe-area-inset-left, 0px));
  border-bottom: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  flex-wrap: nowrap;

  @media (max-width: 600px) {
    gap: 8px;
    padding-left: max(10px, env(safe-area-inset-left, 0px));
    padding-right: max(10px, env(safe-area-inset-right, 0px));
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.back-btn {
  width: 36px !important;
  height: 36px !important;
  border-radius: 50% !important;
  flex-shrink: 0;
}

.header-titles {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.header-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--fg-primary-color);
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .title-icon {
    color: var(--fg-accent-color);
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .title-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 480px) {
    font-size: 0.95rem;

    .title-icon {
      font-size: 1.1rem;
    }
  }
}

.header-subtitle-row {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.74rem;
  color: var(--fg-secondary-color);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;

  .sub-badge {
    font-weight: 700;
    font-size: 0.68rem;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(var(--fg-accent-color-rgb, 99, 102, 241), 0.12);
    color: var(--fg-accent-color);
    letter-spacing: 0.2px;
    flex-shrink: 0;
  }

  .sub-sep {
    opacity: 0.45;
    flex-shrink: 0;
  }

  .sub-topic {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 220px;

    @media (max-width: 480px) {
      max-width: 140px;
    }
  }
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
  flex-shrink: 0;
}

.header-more-btn {
  width: 36px !important;
  height: 36px !important;
  min-width: 36px !important;
  border-radius: 50% !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;

  :deep(.kit-btn-icon) {
    margin: 0 !important;
    font-size: 1.3rem;
  }
}

.header-menu-list {
  display: flex;
  flex-direction: column;
}

.header-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--fg-primary-color);
  font-size: 0.9rem;
  font-weight: 500;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;

  .item-icon {
    font-size: 1.15rem;
    color: var(--fg-secondary-color);
    flex-shrink: 0;

    &.new-icon {
      color: var(--fg-accent-color);
    }
  }

  .item-label {
    flex: 1;
    white-space: nowrap;
  }

  &:hover {
    background: var(--bg-hover-color);
    color: var(--fg-primary-color);

    .item-icon {
      color: var(--fg-accent-color);
    }
  }

  &.is-danger {
    color: rgb(239, 68, 68);

    .item-icon {
      color: rgb(239, 68, 68);
    }

    &:hover {
      background: rgba(239, 68, 68, 0.1);
    }
  }
}

.header-menu-divider {
  height: 1px;
  margin: 4px 6px;
  background: var(--border-primary-color);
}
</style>
