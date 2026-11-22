import type { ApplicationOptions } from 'pixi.js'
import type { Ref } from 'vue'
import { initDevtools } from '@pixi/devtools'
import { Application } from 'pixi.js'
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'

export interface UsePixiOptions extends Partial<ApplicationOptions> {
  resizeToWindow?: boolean
  onInit?: (app: Application) => void | Promise<void>
}

export function usePixiApp(containerRef: Ref<HTMLElement | null>, options: UsePixiOptions = {}) {
  const app = shallowRef<Application | null>(null)
  const isReady = ref(false)
  let isDisposed = false

  onMounted(async () => {
    if (!containerRef.value)
      return

    const instance = new Application()

    const { resizeToWindow = true, onInit, ...initOptions } = options

    await instance.init({
      resizeTo: resizeToWindow ? window : undefined,
      backgroundAlpha: 0,
      preference: 'webgl',
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      ...initOptions,
    })

    if (isDisposed || !containerRef.value) {
      instance.destroy({ removeView: true, releaseGlobalResources: true }, { children: true })

      return
    }

    app.value = instance
    containerRef.value.appendChild(instance.canvas)

    if (import.meta.env.DEV) {
      initDevtools({ app: instance })
    }

    await onInit?.(instance)

    if (!isDisposed) {
      isReady.value = true
    }
  })

  onUnmounted(() => {
    isDisposed = true

    if (app.value) {
      app.value.destroy({ removeView: true, releaseGlobalResources: true }, { children: true, texture: true, textureSource: true })
      app.value = null
      isReady.value = false
    }
  })

  return {
    app,
    isReady,
  }
}
