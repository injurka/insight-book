<script setup lang="ts">
import type { DialogueSession } from '../../../../shared/types/dialogue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog } from '~/02.kit'

interface Props {
  visible: boolean
  sessions: DialogueSession[]
  activeSessionId: string | null
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'select', session: DialogueSession): void
  (e: 'delete', sessionId: string): void
  (e: 'new'): void
}>()

const { t } = useI18n()

function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()

  if (isToday) {
    return `${t('plugins.dialogue-trainer.today')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function handleSelect(session: DialogueSession) {
  emit('select', session)
  emit('update:visible', false)
}

function handleNew() {
  emit('new')
  emit('update:visible', false)
}
</script>

<template>
  <KitDialog
    :visible="visible"
    :title="t('plugins.dialogue-trainer.history')"
    icon="mdi:history"
    :max-width="480"
    :minimizable="false"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="history-content">
      <div class="history-toolbar">
        <KitBtn
          size="sm"
          variant="solid"
          color="primary"
          icon="mdi:plus"
          class="new-chat-btn"
          @click="handleNew"
        >
          {{ t('plugins.dialogue-trainer.newDialogue') }}
        </KitBtn>
      </div>

      <div v-if="sessions.length === 0" class="empty-history">
        <Icon icon="mdi:chat-outline" class="empty-icon" />
        <p>{{ t('plugins.dialogue-trainer.noSessions') }}</p>
      </div>

      <div v-else class="sessions-list">
        <div
          v-for="s in sessions"
          :key="s.id"
          class="session-item"
          :class="{ active: s.id === activeSessionId }"
          @click="handleSelect(s)"
        >
          <div class="session-info">
            <h4 class="session-title">
              {{ s.title || t('plugins.dialogue-trainer.newDialogue') }}
            </h4>
            <div class="session-meta">
              <span class="meta-lang">{{ s.settings.targetLanguage.toUpperCase() }}</span>
              <span class="meta-sep">·</span>
              <span class="meta-count">{{ s.messages.length }} msg</span>
              <span class="meta-sep">·</span>
              <span class="meta-time">{{ formatDate(s.updatedAt) }}</span>
            </div>
          </div>

          <KitBtn
            size="xs"
            variant="text"
            color="error"
            icon="mdi:delete-outline"
            :aria-label="t('plugins.dialogue-trainer.deleteSession')"
            class="delete-btn"
            @click.stop="emit('delete', s.id)"
          />
        </div>
      </div>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.history-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 480px;
}

.history-toolbar {
  display: flex;
  justify-content: flex-end;
}

.new-chat-btn {
  width: 100%;
}

.empty-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: var(--fg-secondary-color);
  gap: 10px;

  .empty-icon {
    font-size: 2.5rem;
    opacity: 0.5;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
  }
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  max-height: 400px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
    background: var(--bg-tertiary-color);
  }

  &.active {
    border-color: var(--fg-accent-color);
    background: var(--bg-accent-color);
  }
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  margin: 0 0 4px;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--fg-secondary-color);
}

.meta-lang {
  font-weight: 700;
  color: var(--fg-accent-color);
}

.delete-btn {
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
}
</style>
