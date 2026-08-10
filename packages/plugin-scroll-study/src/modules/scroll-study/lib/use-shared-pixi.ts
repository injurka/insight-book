import type { ApplicationOptions } from 'pixi.js'
import type { InjectionKey, Ref, ShallowRef } from 'vue'
import { initDevtools } from '@pixi/devtools'
import { Application, Container } from 'pixi.js'
import { inject, onBeforeUnmount, onMounted, provide, ref, shallowRef } from 'vue'

export type PixiLayerName = 'bgLayer' | 'fxLayer' | 'dragLayer'

export interface SharedPixiContext {
  app: ShallowRef<Application | null>
  layers: Record<PixiLayerName, Container>
  isReady: Ref<boolean>
}

export const PIXI_APP_KEY: InjectionKey<SharedPixiContext> = Symbol('PIXI_APP_KEY')

export function providePixiApp(
  containerRef: Ref<HTMLElement | null>,
  options: Partial<ApplicationOptions> = {},
) {
  const app = shallowRef<Application | null>(null)
  const isReady = ref(false)

  const bgLayer = new Container({ label: 'bgLayer', zIndex: 0 })
  const fxLayer = new Container({ label: 'fxLayer', zIndex: 50 })
  const dragLayer = new Container({ label: 'dragLayer', zIndex: 100 })

  const layers: Record<PixiLayerName, Container> = {
    bgLayer,
    fxLayer,
    dragLayer,
  }

  onMounted(async () => {
    if (!containerRef.value)
      return

    const instance = new Application()
    app.value = instance

    await instance.init({
      resizeTo: window,
      backgroundAlpha: 0,
      preference: 'webgl',
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      ...options,
    })

    if (!containerRef.value || app.value !== instance) {
      instance.destroy({ removeView: true, releaseGlobalResources: true }, { children: true })
      return
    }

    containerRef.value.appendChild(instance.canvas)

    // Configure stage layers with z-index sorting
    instance.stage.sortableChildren = true
    instance.stage.addChild(bgLayer)
    instance.stage.addChild(fxLayer)
    instance.stage.addChild(dragLayer)

    if (import.meta.env.DEV) {
      initDevtools({ app: instance })
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

  const context: SharedPixiContext = {
    app,
    layers,
    isReady,
  }

  provide(PIXI_APP_KEY, context)

  return context
}

export function useSharedPixi() {
  const context = inject(PIXI_APP_KEY, null)
  if (!context) {
    throw new Error('useSharedPixi() must be called inside a component tree provided by providePixiApp()')
  }
  return context
}

export function usePixiLayer(layerName: PixiLayerName) {
  const { app, layers, isReady } = useSharedPixi()
  const layer = layers[layerName]

  return {
    app,
    layer,
    isReady,
  }
}
