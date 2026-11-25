<script setup lang="ts">
import type { CustomFunnelStepResult, ProductEventCatalogItem } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitSelect from '~/02.kit/molecules/kit-select.vue'
import KitPanel from '~/02.kit/organisms/kit-panel.vue'
import { formatTransitionMinutes } from '~/03.domain/user'

interface Props {
  catalog: ProductEventCatalogItem[]
  periodDays: number
}

const props = defineProps<Props>()
const { admin } = useRepos()

interface FunnelPreset {
  key: string
  label: string
  steps: string[]
}

const PRESETS: FunnelPreset[] = [
  {
    key: 'reader-journey',
    label: 'Путь читателя',
    steps: ['book_opened', 'ai_word_lookup', 'word_saved_to_dict', 'srs_training_finished'],
  },
  {
    key: 'upload-to-read',
    label: 'Свои книги',
    steps: ['book_uploaded', 'book_opened', 'reading_session_ended'],
  },
  {
    key: 'catalog-flow',
    label: 'Публичный каталог',
    steps: ['public_book_search', 'public_book_downloaded', 'book_opened'],
  },
]

const activePreset = ref<string>('reader-journey')
const customMode = ref(false)
const stepEvents = ref<string[]>([...PRESETS[0].steps])
const results = ref<CustomFunnelStepResult[]>([])
const loading = ref(false)

const selectOptions = computed(() =>
  props.catalog.map(item => ({
    value: item.name,
    label: item.label,
  })),
)

async function loadFunnel() {
  if (stepEvents.value.length < 2)
    return

  loading.value = true

  try {
    const res = await admin.analyticsCustomFunnel(stepEvents.value, props.periodDays)
    results.value = res.steps
  }
  catch {
    results.value = []
  }
  finally {
    loading.value = false
  }
}

function choosePreset(preset: FunnelPreset) {
  activePreset.value = preset.key
  customMode.value = false
  stepEvents.value = [...preset.steps]
  loadFunnel()
}

function enableCustomMode() {
  activePreset.value = 'custom'
  customMode.value = true
}

function updateStep(index: number, newEvent: string) {
  stepEvents.value[index] = newEvent
  activePreset.value = 'custom'
  loadFunnel()
}

function addStep() {
  if (stepEvents.value.length >= 5 || props.catalog.length === 0)
    return

  const fallback = props.catalog.find(c => !stepEvents.value.includes(c.name))?.name ?? props.catalog[0].name
  stepEvents.value.push(fallback)
  loadFunnel()
}

function removeStep(index: number) {
  if (stepEvents.value.length <= 2)
    return

  stepEvents.value.splice(index, 1)
  loadFunnel()
}

watch(() => props.periodDays, () => loadFunnel())
onMounted(() => loadFunnel())
</script>

<template>
  <KitPanel title="Последовательная воронка по событиям" icon="mdi:filter-check-outline">
    <template #meta>
      Строгий порядок действий во времени ({{ periodDays }} дн.)
    </template>

    <div class="ef-toolbar">
      <div class="ef-presets">
        <button
          v-for="preset in PRESETS"
          :key="preset.key"
          type="button"
          class="ef-pill"
          :class="{ 'ef-pill--active': activePreset === preset.key && !customMode }"
          @click="choosePreset(preset)"
        >
          {{ preset.label }}
        </button>
        <button
          type="button"
          class="ef-pill"
          :class="{ 'ef-pill--active': customMode }"
          @click="enableCustomMode"
        >
          <Icon icon="mdi:tune-variant" />
          Настроить шаги
        </button>
      </div>
    </div>

    <div v-if="customMode" class="ef-builder">
      <div v-for="(ev, idx) in stepEvents" :key="idx" class="ef-builder__step">
        <span class="ef-builder__num">{{ idx + 1 }}</span>
        <div class="ef-builder__select">
          <KitSelect
            :model-value="ev"
            :options="selectOptions"
            @update:model-value="val => updateStep(idx, val)"
          />
        </div>
        <button
          v-if="stepEvents.length > 2"
          type="button"
          class="ef-builder__remove"
          title="Удалить шаг"
          @click="removeStep(idx)"
        >
          <Icon icon="mdi:close" />
        </button>
      </div>

      <KitBtn
        v-if="stepEvents.length < 5"
        variant="outline"
        @click="addStep"
      >
        <Icon icon="mdi:plus" />
        <span>Добавить шаг</span>
      </KitBtn>
    </div>

    <div v-if="loading" class="ef-skeletons">
      <KitSkeleton v-for="i in stepEvents.length" :key="i" height="44px" />
    </div>

    <div v-else-if="results.length" class="ef-steps">
      <div v-for="step in results" :key="`${step.stepIndex}-${step.event}`" class="ef-step">
        <div class="ef-step__head">
          <div class="ef-step__left">
            <span class="ef-step__badge">{{ step.stepIndex }}</span>
            <span class="ef-step__label">{{ step.label }}</span>
            <span class="ef-step__code">{{ step.event }}</span>
          </div>

          <div class="ef-step__right">
            <span
              v-if="step.medianMinutesFromPrev !== null"
              class="ef-step__time"
              title="Медианное время от предыдущего шага"
            >
              <Icon icon="mdi:timer-sand" />
              {{ formatTransitionMinutes(step.medianMinutesFromPrev) }}
            </span>
            <span v-if="step.stepIndex > 1" class="ef-step__conv" title="Конверсия с предыдущего шага">
              <Icon icon="mdi:arrow-right-thin" />
              {{ step.conversionFromPrev }}%
            </span>
            <span class="ef-step__users">{{ step.usersCount }} чел.</span>
            <span class="ef-step__pct">{{ step.percentOfFirst }}%</span>
          </div>
        </div>

        <div class="ef-step__track">
          <div
            class="ef-step__fill"
            :style="{ width: `${Math.max(step.percentOfFirst, step.usersCount > 0 ? 3 : 0)}%` }"
          />
        </div>
      </div>
    </div>
  </KitPanel>
</template>

<style scoped>
.ef-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.ef-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ef-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  background: var(--bg-primary-color, #f3efe9);
  color: var(--fg-secondary-color, #8e867b);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s,
    border-color 0.15s;
}

.ef-pill:hover {
  color: var(--fg-primary-color, #4a443c);
}

.ef-pill--active {
  background: var(--fg-accent-color, #4b8266);
  border-color: var(--fg-accent-color, #4b8266);
  color: #f3efe9;
  font-weight: 600;
}

.ef-builder {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px;
  margin-bottom: 16px;
  border-radius: 8px;
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
}

.ef-builder__step {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ef-builder__num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-secondary-color, #e8e2d9);
  color: var(--fg-secondary-color, #8e867b);
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ef-builder__select {
  width: 230px;
}

.ef-builder__remove {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color, #8e867b);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ef-builder__remove:hover {
  background: var(--bg-error-color, #f5e3e3);
  color: var(--fg-error-color, #c46d6d);
}

.ef-skeletons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ef-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ef-step {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ef-step__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.ef-step__left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ef-step__badge {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-primary-color, #c7c0b6);
  color: var(--fg-secondary-color, #8e867b);
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ef-step__label {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
}

.ef-step__code {
  font-size: 11px;
  font-family: monospace;
  color: var(--fg-secondary-color, #8e867b);
  background: var(--bg-primary-color, #f3efe9);
  padding: 1px 6px;
  border-radius: 4px;
}

.ef-step__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ef-step__time {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11.5px;
  color: var(--fg-warning-color, #b38f2b);
  background: var(--bg-warning-color, #fcf4dd);
  padding: 2px 7px;
  border-radius: 999px;
  font-weight: 500;
}

.ef-step__conv {
  display: inline-flex;
  align-items: center;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--fg-secondary-color, #8e867b);
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  padding: 2px 8px 2px 4px;
  border-radius: 999px;
}

.ef-step__users {
  font-size: 14px;
  font-weight: 700;
  color: var(--fg-primary-color, #4a443c);
  min-width: 52px;
  text-align: right;
}

.ef-step__pct {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-accent-color, #4b8266);
  min-width: 38px;
  text-align: right;
}

.ef-step__track {
  height: 9px;
  border-radius: 999px;
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  overflow: hidden;
}

.ef-step__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #4b8266 0%, #6ea588 100%);
  transition: width 0.3s ease;
}
</style>
