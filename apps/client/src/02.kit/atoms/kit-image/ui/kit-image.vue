<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { API_URL } from '~/01.shared/lib/env'
import { KitSkeleton } from '~/02.kit'

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
const isInstant = ref(false)
const imgRef = ref<HTMLImageElement | null>(null)

// Сколько мс после монтирования считаем загрузку «мгновенной» (картинка из кэша)
const INSTANT_LOAD_THRESHOLD = 150
let mountedAt = 0

onMounted(() => {
  mountedAt = performance.now()
  // Картинка уже в кэше браузера — показываем сразу, без fade-in.
  // Важно для View Transitions: новый снапшот снимается в первый кадр после монтирования.
  const img = imgRef.value
  if (img?.complete && img.naturalWidth > 0) {
    isLoaded.value = true
    isInstant.value = true
  }
})

const resolvedSrc = computed(() => {
  if (!props.src)
    return ''
  if (props.src.startsWith('data:') || props.src.startsWith('http') || props.src.startsWith('blob:'))
    return props.src

  const BASE = API_URL
  return `${BASE}${props.src}`
})

watch(() => props.src, () => {
  isLoaded.value = false
  hasError.value = false
  isInstant.value = false
  mountedAt = performance.now()
})

function handleLoad() {
  if (performance.now() - mountedAt < INSTANT_LOAD_THRESHOLD)
    isInstant.value = true

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
      ref="imgRef"
      :src="resolvedSrc"
      :alt="alt"
      :loading="lazy ? 'lazy' : 'eager'"
      class="kit-image-layer real-image"
      :class="{ 'is-loaded': isLoaded, 'is-instant': isInstant }"
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

  &.is-instant {
    transition: none;
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
