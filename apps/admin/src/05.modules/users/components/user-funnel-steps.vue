<script setup lang="ts">
import type { UserFunnelStepStatus } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import KitPanel from '~/02.kit/organisms/kit-panel.vue'

interface Props {
  steps: UserFunnelStepStatus[]
}

const props = defineProps<Props>()

const completedCount = computed(() => props.steps.filter(s => s.completed).length)
</script>

<template>
  <KitPanel title="Путь пользователя" icon="mdi:check-decagram-outline">
    <template #meta>
      {{ completedCount }} из {{ steps.length }} этапов
    </template>

    <ol class="steps">
      <li
        v-for="step in steps"
        :key="step.key"
        class="step"
        :class="{ 'step--done': step.completed }"
      >
        <Icon
          :icon="step.completed ? 'mdi:check-circle' : 'mdi:circle-outline'"
          class="step__icon"
        />
        <span class="step__label">{{ step.label }}</span>
      </li>
    </ol>
  </KitPanel>
</template>

<style scoped>
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 8px;
}

.step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  color: var(--fg-secondary-color, #8e867b);
}

.step--done {
  background: var(--bg-success-color, #e4eee6);
  border-color: var(--border-success-color, #7dae94);
  color: #2d5641;
  font-weight: 600;
}

.step__icon {
  font-size: 17px;
  flex-shrink: 0;
}
</style>
