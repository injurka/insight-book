<script setup lang="ts">
import { Mesh, MeshGeometry, Shader, UniformGroup } from 'pixi.js'
import { onBeforeUnmount, watch } from 'vue'
import { usePixiLayer } from '../../lib/use-shared-pixi'
import fragmentSource from '../../shaders/qi-shader.frag?raw'
import vertexSource from '../../shaders/qi-shader.vert?raw'

const { app, layer, isReady } = usePixiLayer('bgLayer')
let mesh: Mesh | null = null

const stopWatch = watch([isReady, app], ([ready, pixi]) => {
  if (!ready || !pixi || mesh)
    return

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

  mesh = new Mesh({ geometry, shader })
  layer.addChild(mesh)

  const startTime = performance.now()

  pixi.ticker.add(() => {
    uniforms.uniforms.uTime = (performance.now() - startTime) * 0.001
  })
}, { immediate: true })

onBeforeUnmount(() => {
  stopWatch()
  if (mesh) {
    mesh.destroy()
    mesh = null
  }
})
</script>

<template>
  <div class="scroll-background-container" />
</template>


<style lang="scss" scoped>
.scroll-background-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;

  :deep(canvas) {
    width: 100%;
    height: 100%;
    display: block;
    opacity: 0.45;
  }
}
</style>
