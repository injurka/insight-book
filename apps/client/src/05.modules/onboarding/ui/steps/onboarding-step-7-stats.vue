<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import OnboardingStepLayout from './onboarding-step-layout.vue'

const emit = defineEmits<{
  next: []
}>()
const { t } = useI18n()
const isLit = ref(false)

onMounted(() => {
  setTimeout(() => {
    isLit.value = true
  }, 500)
})
</script>

<template>
  <OnboardingStepLayout
    :title="t('onboarding.step7_title')"
    :description="t('onboarding.step7_desc')"
    icon="mdi:chart-box"
    icon-class="accent-icon"
  >
    <div class="interactive-zone">
      <div class="fake-heatmap">
        <div
          v-for="i in 14"
          :key="i"
          class="fake-cell"
          :class="{ active: i === 14 && isLit }"
        />
      </div>

      <Transition name="fade-slide-up">
        <div v-if="isLit" class="achievement">
          <Icon icon="mdi:fire" class="fire-icon" />
          <span>{{ t('onboarding.step7_action') }}</span>
        </div>
      </Transition>
    </div>

    <!-- Фиксированная зона действий -->
    <div class="step-actions">
      <Transition name="fade" mode="out-in">
        <KitBtn
          v-if="isLit"
          color="primary"
          class="next-btn"
          @click="emit('next')"
        >
          {{ t('onboarding.next') }} <Icon icon="mdi:arrow-right" />
        </KitBtn>
      </Transition>
    </div>
  </OnboardingStepLayout>
</template>

<style lang="scss" scoped>
:deep(.accent-icon) {
  color: var(--fg-accent-color) !important;
}

.interactive-zone {
  width: 100%;
  padding: 32px;
  margin-bottom: 32px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.step-actions {
  height: 60px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fake-heatmap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 240px;
  justify-content: center;
  margin-bottom: 24px;

  .fake-cell {
    width: 24px;
    height: 24px;
    background: var(--bg-tertiary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: 4px;
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);

    &.active {
      background: var(--fg-success-color);
      border-color: var(--fg-success-color);
      box-shadow: 0 0 12px rgba(34, 197, 94, 0.6);
      transform: scale(1.2);
    }
  }
}

.achievement {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-warning-color);
  font-weight: bold;
  font-size: 1.2rem;

  .fire-icon {
    font-size: 1.5rem;
  }
}

.next-btn {
  font-size: 1.1rem;
  padding: 12px 32px;
  border-radius: 99px;
}

.fade-slide-up-enter-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
