<script setup lang="ts" generic="T extends string | number">
import type { Component } from 'vue'
import type { ViewSwitcherItem } from '~/02.kit/molecules/kit-view-switcher'
import { computed, ref } from 'vue'
import { KitViewSwitcher } from '~/02.kit/molecules/kit-view-switcher'
import { useTabsTransition } from '../composables/use-tabs-transition'

export interface TabItem<T extends string | number = string | number> extends ViewSwitcherItem<T> {
  component?: Component
  props?: Record<string, any>
}

export interface Props<T extends string | number = string | number> {
  items: TabItem<T>[]
  cache?: boolean
}

const props = defineProps<Props<T>>()

const model = defineModel<T>({ required: true })

const currentTab = computed(() => props.items.find(item => item.id === model.value))
const currentProps = computed(() => currentTab.value?.props || {})

const contentWrapperRef = ref<HTMLElement | null>(null)

const {
  transitionName,
  onBeforeLeave,
  onEnter,
  onAfterEnter,
} = useTabsTransition(model, computed(() => props.items), contentWrapperRef)
</script>

<template>
  <div class="kit-tabs" :class="{ single: items.length === 1 }">
    <KitViewSwitcher v-model="model" :items="items" full-width />

    <div v-if="currentTab" class="mobile-tab-info">
      <span class="mobile-tab-label">{{ currentTab.label }}</span>
    </div>

    <div ref="contentWrapperRef" class="kit-tabs-content-wrapper">
      <Transition
        v-if="!cache"
        :name="transitionName"
        @before-leave="onBeforeLeave"
        @enter="onEnter"
        @after-enter="onAfterEnter"
      >
        <div :key="model" class="kit-tabs-pane">
          <slot :name="model" />
        </div>
      </Transition>

      <Transition
        v-else
        :name="transitionName"
        @before-leave="onBeforeLeave"
        @enter="onEnter"
        @after-enter="onAfterEnter"
      >
        <KeepAlive>
          <component
            :is="currentTab?.component"
            v-bind="currentProps"
            :key="model"
            class="kit-tabs-pane"
          />
        </KeepAlive>
      </Transition>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.kit-tabs {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;

  &.single {
    :deep(.kit-view-switcher-glider) {
      opacity: 0 !important;
    }
  }
}

.mobile-tab-info {
  display: none;
  text-align: center;
  animation: fade-in 0.3s ease;
  margin-top: 0px;

  .mobile-tab-label {
    display: inline-block;
    padding: 4px 12px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--fg-accent-color);
    border-radius: 20px;
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    letter-spacing: 1px;
  }
}

@include media-down(sm) {
  .mobile-tab-info {
    display: block;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.kit-tabs-content-wrapper {
  position: relative;
  transition: height 0.3s ease-in-out;
  min-height: 50px;
  z-index: 6;
  overflow: hidden;
}

.kit-tabs-pane {
  width: 100%;
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.3s ease-in-out;
}

.slide-left-leave-active,
.slide-right-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
}

.slide-left-enter-from {
  transform: translateX(100%);
  opacity: 0;
}
.slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-right-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
