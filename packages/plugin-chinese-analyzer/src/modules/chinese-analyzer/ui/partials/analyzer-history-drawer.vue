<script setup lang="ts">
import type { AnalysisHistoryItem } from '../../model'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'

interface Props {
  visible: boolean
  items: AnalysisHistoryItem[]
  activeHanzi: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'select': [item: AnalysisHistoryItem]
  'remove': [id: string]
  'clear': []
}>()

const { t } = useI18n()

function onSelectItem(item: AnalysisHistoryItem): void {
  emit('select', item)
  emit('update:visible', false)
}
</script>

<template>
  <KitDialog
    :visible="props.visible"
    :title="t('plugins.chinese-analyzer.historyTitle')"
    icon="mdi:history"
    :max-width="580"
    :minimizable="false"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="history-dialog-body">
      <div v-if="props.items.length === 0" class="history-empty">
        <Icon icon="mdi:history" class="empty-icon" />
        <p>{{ t('plugins.chinese-analyzer.historyEmpty') }}</p>
      </div>

      <template v-else>
        <div class="history-list">
          <div
            v-for="item in props.items"
            :key="item.id"
            class="history-item-card"
            :class="{ active: item.hanzi === props.activeHanzi }"
            @click="onSelectItem(item)"
          >
            <div class="hi-content">
              <div class="hi-top">
                <span class="hi-hsk">{{ item.hskLevel }}</span>
                <span class="hi-hanzi">{{ item.hanzi }}</span>
              </div>
              <div class="hi-pinyin">
                {{ item.pinyin }}
              </div>
              <div class="hi-trans">
                {{ item.translation }}
              </div>
            </div>

            <button
              type="button"
              class="hi-delete-btn"
              @click.stop="emit('remove', item.id)"
            >
              <Icon icon="mdi:delete-outline" />
            </button>
          </div>
        </div>

        <div class="history-footer">
          <KitBtn
            variant="tonal"
            color="error"
            size="sm"
            icon="mdi:delete-outline"
            @click="emit('clear')"
          >
            {{ t('plugins.chinese-analyzer.clearHistory') }}
          </KitBtn>
        </div>
      </template>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.history-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 16px;
  text-align: center;
  color: var(--fg-secondary-color);

  .empty-icon {
    font-size: 2.2rem;
    opacity: 0.5;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
  }
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 420px;
  overflow-y: auto;
}

.history-item-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 13px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    border-color: var(--fg-accent-color);
  }

  &.active {
    border-color: var(--fg-accent-color);
    background: rgba(var(--fg-accent-color-rgb), 0.08);
  }

  .hi-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .hi-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hi-hsk {
    padding: 1px 6px;
    border-radius: 6px;
    font-size: 0.68rem;
    font-weight: 700;
    background: rgba(var(--fg-accent-color-rgb), 0.14);
    color: var(--fg-accent-color);
  }

  .hi-hanzi {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .hi-pinyin {
    font-size: 0.76rem;
    color: var(--fg-accent-color);
  }

  .hi-trans {
    font-size: 0.82rem;
    color: var(--fg-secondary-color);
  }

  .hi-delete-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--fg-tertiary-color);
    cursor: pointer;
    flex-shrink: 0;

    &:hover {
      background: rgba(239, 68, 68, 0.12);
      color: #ef4444;
    }
  }
}

.history-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
  border-top: 1px solid var(--border-secondary-color);
}
</style>
