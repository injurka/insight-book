<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import fragmentSource from '../../shaders/qi-shader.frag?raw'
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
    console.error('Shader compile error:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }

  return shader
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas)
    return

  const gl = canvas.getContext('webgl')
  if (!gl) {
    console.error('WebGL context is not available')
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
    console.error('Program link error:', gl.getProgramInfoLog(program))
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

  const resize = () => {
    if (!canvas)
      return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  window.addEventListener('resize', resize)
  resize()

  const startTime = performance.now()

  const render = () => {
    const time = (performance.now() - startTime) * 0.001
    gl.uniform1f(uTime, time)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    animId = requestAnimationFrame(render)
  }

  render()

  onBeforeUnmount(() => {
    window.removeEventListener('resize', resize)
    if (animId)
      cancelAnimationFrame(animId)
  })
})
</script>

<template>
  <div class="scroll-background-container">
    <canvas ref="canvasRef" class="bg-canvas" />
  </div>
</template>

<style lang="scss" scoped>
.scroll-background-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.bg-canvas {
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0.35;
}
</style>
