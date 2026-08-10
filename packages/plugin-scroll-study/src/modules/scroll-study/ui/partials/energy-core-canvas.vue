<script setup lang="ts">
import { Application, Mesh, MeshGeometry, Shader, UniformGroup } from 'pixi.js'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import fragmentSource from '../../shaders/energy-core.frag?raw'
import vertexSource from '../../shaders/qi-shader.vert?raw'

const containerRef = ref<HTMLDivElement | null>(null)
let pixiApp: Application | null = null

onMounted(async () => {
  if (!containerRef.value)
    return

  const app = new Application()
  pixiApp = app

  await app.init({
    width: 120,
    height: 120,
    backgroundAlpha: 0,
    preference: 'webgl',
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  })

  if (!containerRef.value || !pixiApp) {
    app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true })
    return
  }

  containerRef.value.appendChild(app.canvas)

  const uniforms = new UniformGroup({
    uTime: { value: 0, type: 'f32' },
  })

  const shader = Shader.from({
    gl: {
      vertex: vertexSource,
      fragment: fragmentSource,
    },
    resources: {
      uniforms,
    },
  })

  const geometry = new MeshGeometry({
    positions: new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]),
    indices: new Uint32Array([0, 1, 2, 1, 3, 2]),
  })

  const mesh = new Mesh({ geometry, shader })
  app.stage.addChild(mesh)

  const startTime = performance.now()

  app.ticker.add(() => {
    uniforms.uniforms.uTime = (performance.now() - startTime) * 0.001
  })
})

onBeforeUnmount(() => {
  if (pixiApp) {
    pixiApp.destroy(
      { removeView: true, releaseGlobalResources: true },
      { children: true },
    )
    pixiApp = null
  }
})
</script>

<template>
  <div ref="containerRef" class="energy-shader-wrapper" />
</template>

<style lang="scss" scoped>
.energy-shader-wrapper {
  position: absolute;
  inset: -4px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 5;

  :deep(canvas) {
    width: 100%;
    height: 100%;
    object-fit: contain;
    animation: energy-canvas-breath 3.5s ease-in-out infinite alternate;
  }
}

@keyframes energy-canvas-breath {
  0% {
    transform: scale(0.95);
    opacity: 0.88;
  }
  100% {
    transform: scale(1.04);
    opacity: 1;
  }
}
</style>

