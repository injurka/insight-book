<script setup lang="ts">
import { Mesh, MeshGeometry, Shader, UniformGroup } from 'pixi.js'
import { onBeforeUnmount, watch } from 'vue'
import { usePixiLayer } from '../../lib/use-shared-pixi'
import fragmentSource from '../../shaders/qi-shader.frag?raw'
import vertexSource from '../../shaders/qi-shader.vert?raw'

const { app, layer, isReady } = usePixiLayer('bgLayer')
let mesh: Mesh<MeshGeometry, Shader> | null = null
let stopTicker: (() => void) | undefined

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
    uvs: new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      1, 1,
    ]),
    indices: new Uint32Array([0, 1, 2, 1, 3, 2]),
  })

  const fogMesh = new Mesh({ geometry, shader })
  mesh = fogMesh
  layer.addChild(fogMesh)

  const startTime = performance.now()

  const animateFog = () => {
    uniforms.uniforms.uTime = (performance.now() - startTime) * 0.001
  }
  pixi.ticker.add(animateFog)
  stopTicker = () => pixi.ticker.remove(animateFog)
}, { immediate: true })

onBeforeUnmount(() => {
  stopWatch()
  stopTicker?.()
  if (mesh) {
    mesh.destroy()
    mesh = null
  }
})
</script>

<template>
  <div class="scroll-background-container" aria-hidden="true">
    <div class="landscape-layer landscape-distant" />
    <div class="landscape-layer landscape-foreground" />
    <div class="landscape-vignette" />
  </div>
</template>

<style lang="scss" scoped>
.scroll-background-container {
  // Let the shared Pixi canvas sit between the landscape planes.
  display: contents;
}

.landscape-layer,
.landscape-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.landscape-layer {
  background: url('~plugin/assets/bg_primary.png') center / cover no-repeat;
  filter: brightness(0.5) saturate(0.55);
}

.landscape-distant {
  z-index: 0;
  opacity: 0.48;
}

.landscape-foreground {
  z-index: 2;
  opacity: 0.38;
  // Keep the nearby foliage and lower shoreline in front of the mist.
  mask-image:
    linear-gradient(to top, #000 0%, rgba(0, 0, 0, 0.85) 12%, transparent 38%),
    linear-gradient(to right, #000 0%, transparent 23%, transparent 80%, #000 100%);
  mask-repeat: no-repeat;
  mask-size: 100% 100%;
}

.landscape-vignette {
  z-index: 3;
  background: radial-gradient(ellipse at 50% 45%, transparent 25%, rgba(20, 9, 2, 0.5) 100%);
}
</style>
