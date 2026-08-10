import type { ApplicationOptions } from 'pixi.js'
import type { Ref } from 'vue'
import { initDevtools } from '@pixi/devtools'
import { Application } from 'pixi.js'
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

export interface UsePixiOptions extends Partial<ApplicationOptions> {
  resizeToWindow?: boolean
  onInit?: (app: Application) => void | Promise<void>
}

export function usePixiApp(
  containerRef: Ref<HTMLElement | null>,
  options: UsePixiOptions = {},
) {
  const app = shallowRef<Application | null>(null)
  const isReady = ref(false)

  onMounted(async () => {
    if (!containerRef.value)
      return

    const instance = new Application()
    app.value = instance

    const { resizeToWindow = true, onInit, ...initOptions } = options

    await instance.init({
      resizeTo: resizeToWindow ? window : undefined,
      backgroundAlpha: 0,
      preference: 'webgl',
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      ...initOptions,
    })

    if (!containerRef.value || app.value !== instance) {
      instance.destroy({ removeView: true, releaseGlobalResources: true }, { children: true })
      return
    }

    containerRef.value.appendChild(instance.canvas)

    if (import.meta.env.DEV) {
      initDevtools({ app: instance })
    }

    if (onInit) {
      await onInit(instance)
    }

    isReady.value = true
  })

  onBeforeUnmount(() => {
    if (app.value) {
      app.value.destroy(
        { removeView: true, releaseGlobalResources: true },
        { children: true, texture: true, textureSource: true },
      )
      app.value = null
      isReady.value = false
    }
  })

  return {
    app,
    isReady,
  }
}
