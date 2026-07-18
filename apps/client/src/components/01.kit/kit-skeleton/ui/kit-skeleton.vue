<script setup lang="ts">
interface Props {
  type?: 'wave'
  width?: string | number
  height?: string | number
  borderRadius?: string
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'wave',
  width: '100%',
  height: '1.2em',
  borderRadius: '4px',
  color: 'var(--bg-secondary-color)',
})

const style = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
  borderRadius: props.borderRadius,
  backgroundColor: props.color,
}))
</script>

<template>
  <div
    class="kit-skeleton"
    :class="{ 'kit-skeleton--wave': type === 'wave' }"
    :style="style"
  >
    ‌
  </div>
</template>

<style lang="scss">
.kit-skeleton {
  color: transparent;
  display: block;
  user-select: none;
}

.kit-skeleton * {
  visibility: hidden;
}

.kit-skeleton--wave {
  position: relative;
  overflow: hidden;
}

.kit-skeleton--wave::after {
  animation: wave 1.5s linear 0s infinite;
  background: linear-gradient(90deg, transparent, var(--bg-overlay-primary-color), transparent);
  content: '';
  position: absolute;
  transform: translate3d(-100%, 0, 0);
  will-change: transform;
  inset: 0;
}

@keyframes wave {
  0% {
    transform: translate3d(-100%, 0, 0);
  }
  60% {
    transform: translate3d(100%, 0, 0);
  }
  100% {
    transform: translate3d(100%, 0, 0);
  }
}
</style>
