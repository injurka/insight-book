<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { isTauri } from '~/01.shared/lib/env'
import { setImmersiveMode } from '~/01.shared/services/immersive.service'
import { setScreenOrientation } from '~/01.shared/services/orientation.service'

// Страницы плагинов с `immersive: true` живут здесь:
// никакого хрома приложения, edge-to-edge фон, скрытые системные панели (Android)
// и опциональная блокировка ориентации (meta.orientation из маршрута плагина).
const route = useRoute()

let orientationLocked = false

onMounted(() => {
  if (!isTauri)
    return

  void setImmersiveMode(true)

  const orientation = route.meta.orientation
  if (orientation === 'landscape' || orientation === 'portrait') {
    orientationLocked = true
    void setScreenOrientation(orientation)
  }
})

onUnmounted(() => {
  if (!isTauri)
    return

  void setImmersiveMode(false)

  if (orientationLocked) {
    orientationLocked = false
    void setScreenOrientation(null)
  }
})
</script>

<template>
  <div class="immersive-root">
    <slot />
  </div>
</template>

<style scoped lang="scss">
.immersive-root {
  position: fixed;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  // Сознательно никаких env(safe-area-inset-*):
  // фон полноэкранных страниц должен уходить под системные панели.
}
</style>
