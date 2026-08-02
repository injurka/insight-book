<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import fragmentSource from '../../shaders/energy-core.frag?raw'
import vertexSource from '../../shaders/qi-shader.vert?raw'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animId: number | null = null

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader)
    return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('EnergyCore shader error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }

  return shader
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas)
    return

  const gl = canvas.getContext('webgl', { alpha: true, antialias: true })
  if (!gl) {
    console.error('WebGL is unavailable')
    return
  }

  const vert = createShader(gl, gl.VERTEX_SHADER, vertexSource)
  const frag = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  if (!vert || !frag)
    return

  const program = gl.createProgram()
  if (!program)
    return

  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('EnergyCore program error:', gl.getProgramInfoLog(program))
    return
  }

  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]),
    gl.STATIC_DRAW,
  )

  const posAttr = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(posAttr)
  gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0)

  const uTime = gl.getUniformLocation(program, 'uTime')

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  const startTime = performance.now()

  const render = () => {
    if (!gl || !canvas)
      return
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const time = (performance.now() - startTime) * 0.001
    gl.uniform1f(uTime, time)
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    animId = requestAnimationFrame(render)
  }

  render()
})

onBeforeUnmount(() => {
  if (animId)
    cancelAnimationFrame(animId)
})
</script>

<template>
  <div class="energy-shader-wrapper">
    <canvas ref="canvasRef" width="120" height="120" class="energy-canvas" />
  </div>
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
}

.energy-canvas {
  width: 100%;
  height: 100%;
  object-fit: contain;
  animation: energy-canvas-breath 3.5s ease-in-out infinite alternate;
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
