<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, watch } from 'vue'
import { KitSkeleton } from '~/components/01.kit'

interface Props {
  src?: string | null
  alt?: string
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  lazy?: boolean
  fallbackIcon?: string
}

const props = withDefaults(defineProps<Props>(), {
  objectFit: 'cover',
  lazy: true,
  fallbackIcon: 'mdi:image-outline',
})

const isLoaded = ref(false)
const hasError = ref(false)

const resolvedSrc = computed(() => {
  if (!props.src)
    return ''
  if (props.src.startsWith('data:') || props.src.startsWith('http') || props.src.startsWith('blob:')) {
    return props.src
  }
  const BASE = import.meta.env.VITE_API_URL || 'https://insight-api.trip-scheduler.ru'
  return `${BASE}${props.src}`
})

watch(() => props.src, () => {
  isLoaded.value = false
  hasError.value = false
})

function handleLoad() {
  isLoaded.value = true
}

function handleError() {
  hasError.value = true
  isLoaded.value = false
}
</script>

<template>
  <div class="kit-image">
    <Transition name="fade">
      <div v-if="resolvedSrc && !isLoaded && !hasError" class="kit-image-layer placeholder">
        <slot name="loader">
          <KitSkeleton width="100%" height="100%" />
        </slot>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="!resolvedSrc || hasError" class="kit-image-layer fallback">
        <slot name="error">
          <Icon :icon="fallbackIcon" class="fallback-icon" />
        </slot>
      </div>
    </Transition>

    <img
      v-if="resolvedSrc"
      :src="resolvedSrc"
      :alt="alt"
      :loading="lazy ? 'lazy' : 'eager'"
      class="kit-image-layer real-image"
      :class="{ 'is-loaded': isLoaded }"
      :style="{ objectFit }"
      @load="handleLoad"
      @error="handleError"
    >
  </div>
</template>

<style lang="scss" scoped>
.kit-image {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  overflow: hidden;
  background-color: var(--bg-tertiary-color);
}

.kit-image-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.real-image {
  opacity: 0;
  transition:
    opacity 0.3s ease-in-out,
    transform 0.3s ease-in-out;

  &.is-loaded {
    opacity: 1;
  }
}

.fallback {
  color: var(--fg-muted-color);
  background-color: var(--bg-tertiary-color);

  .fallback-icon {
    font-size: 4rem;
    opacity: 0.5;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>