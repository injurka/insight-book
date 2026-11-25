<script setup lang="ts">
import type { AdminUserDetailedAnalytics } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import KitPanel from '~/02.kit/organisms/kit-panel.vue'
import { formatCost, formatTokens } from '~/03.domain/user'

interface Props {
  llm: AdminUserDetailedAnalytics['llm']
}

const props = defineProps<Props>()

const COLLAPSED_LIMIT = 7

const expanded = ref(false)

const hiddenCount = computed(() => Math.max(0, props.llm.byAction.length - COLLAPSED_LIMIT))
const rows = computed(() => (expanded.value ? props.llm.byAction : props.llm.byAction.slice(0, COLLAPSED_LIMIT)))
const maxTokens = computed(() => Math.max(1, ...props.llm.byAction.map(a => a.inputTokens + a.outputTokens)))

function share(inputTokens: number, outputTokens: number): number {
  return Math.round(((inputTokens + outputTokens) / maxTokens.value) * 100)
}
</script>

<template>
  <KitPanel title="Использование AI" icon="mdi:sparkles">
    <template #meta>
      <span class="cost">{{ formatCost(llm.totalCost) }}</span>
    </template>

    <ul v-if="llm.byAction.length" class="rows">
      <li v-for="item in rows" :key="item.action" class="row">
        <div class="row__top">
          <span class="row__action" :title="item.action">{{ item.action }}</span>
          <span class="row__tokens">{{ formatTokens(item.inputTokens + item.outputTokens) }}</span>
          <span class="row__cost">{{ formatCost(item.cost) }}</span>
        </div>
        <div class="row__bar">
          <div class="row__bar-fill" :style="{ width: `${share(item.inputTokens, item.outputTokens)}%` }" />
        </div>
      </li>
    </ul>
    <p v-else class="empty">
      AI-запросов пока не было
    </p>

    <button
      v-if="hiddenCount > 0"
      type="button"
      class="toggle"
      @click="expanded = !expanded"
    >
      <Icon :icon="expanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
      {{ expanded ? 'Свернуть' : `Показать все (ещё ${hiddenCount})` }}
    </button>
  </KitPanel>
</template>

<style scoped>
.cost {
  font-size: 14px;
  font-weight: 700;
  color: var(--fg-accent-color, #4b8266);
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.row__top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 64px;
  align-items: baseline;
  gap: 10px;
  font-size: 12.5px;
}

.row__action {
  font-weight: 500;
  color: var(--fg-primary-color, #4a443c);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row__tokens {
  color: var(--fg-secondary-color, #8e867b);
}

.row__cost {
  text-align: right;
  font-weight: 600;
  color: var(--fg-accent-color, #4b8266);
}

.row__bar {
  height: 4px;
  border-radius: 999px;
  background: var(--bg-primary-color, #f3efe9);
  overflow: hidden;
}

.row__bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--fg-highlight-color, #c2a14d);
}

.toggle {
  margin-top: 12px;
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px;
  border: 1px dashed var(--border-primary-color, #c7c0b6);
  border-radius: 8px;
  background: transparent;
  color: var(--fg-secondary-color, #8e867b);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.toggle:hover {
  background: var(--bg-hover-color, #d9d1c7);
  color: var(--fg-primary-color, #4a443c);
}

.empty {
  margin: 0;
  padding: 12px 0;
  font-size: 13px;
  color: var(--fg-secondary-color, #8e867b);
}
</style>
