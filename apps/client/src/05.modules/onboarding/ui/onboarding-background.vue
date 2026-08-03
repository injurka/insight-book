<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useChangeTheme } from '~/01.shared/composables/use-change-theme'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { theme } = useChangeTheme()

let animId: number | null = null
let glContext: WebGLRenderingContext | null = null
let uBgPrimaryLoc: WebGLUniformLocation | null = null
let uBgSecondaryLoc: WebGLUniformLocation | null = null
let uBgAccentLoc: WebGLUniformLocation | null = null
let uFgAccentLoc: WebGLUniformLocation | null = null
let observer: MutationObserver | null = null

function parseColorToVec3(colorStr: string, fallback: [number, number, number]): [number, number, number] {
  if (!colorStr || !colorStr.trim())
    return fallback

  const temp = document.createElement('div')
  temp.style.color = colorStr.trim()
  document.body.appendChild(temp)
  const computedColor = getComputedStyle(temp).color
  document.body.removeChild(temp)

  const matches = computedColor.match(/\d+(\.\d+)?/g)
  if (matches && matches.length >= 3) {
    return [
      Number.parseFloat(matches[0]) / 255,
      Number.parseFloat(matches[1]) / 255,
      Number.parseFloat(matches[2]) / 255,
    ]
  }

  return fallback
}

function getThemeColors() {
  const styles = getComputedStyle(document.body)
  const bgPrimary = styles.getPropertyValue('--bg-primary-color')
  const bgSecondary = styles.getPropertyValue('--bg-secondary-color')
  const bgAccent = styles.getPropertyValue('--bg-accent-color')
  const fgAccent = styles.getPropertyValue('--fg-accent-color')

  return {
    bgPrimary: parseColorToVec3(bgPrimary, [0.05, 0.07, 0.09]),
    bgSecondary: parseColorToVec3(bgSecondary, [0.1, 0.12, 0.15]),
    bgAccent: parseColorToVec3(bgAccent, [0.18, 0.13, 0.24]),
    fgAccent: parseColorToVec3(fgAccent, [0.78, 0.46, 0.87]),
  }
}

function updateColors() {
  if (!glContext)
    return

  const colors = getThemeColors()

  if (uBgPrimaryLoc)
    glContext.uniform3fv(uBgPrimaryLoc, new Float32Array(colors.bgPrimary))

  if (uBgSecondaryLoc)
    glContext.uniform3fv(uBgSecondaryLoc, new Float32Array(colors.bgSecondary))

  if (uBgAccentLoc)
    glContext.uniform3fv(uBgAccentLoc, new Float32Array(colors.bgAccent))

  if (uFgAccentLoc)
    glContext.uniform3fv(uFgAccentLoc, new Float32Array(colors.fgAccent))
}

function scheduleUpdateColors() {
  requestAnimationFrame(() => {
    updateColors()
    setTimeout(() => {
      updateColors()
    }, 50)
  })
}

const vertexSource = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const fragmentSource = `
  precision highp float;
  uniform float uTime;
  uniform vec3 uBgPrimary;
  uniform vec3 uBgSecondary;
  uniform vec3 uBgAccent;
  uniform vec3 uFgAccent;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; ++i) {
      v += a * noise(p);
      p = rot * p * 2.0 + vec2(100.0);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv * 1.8;
    
    vec2 q = vec2(0.0);
    q.x = fbm(uv + 0.04 * uTime);
    q.y = fbm(uv + vec2(1.0));

    vec2 r = vec2(0.0);
    r.x = fbm(uv + 1.0 * q + vec2(1.7, 9.2) + 0.06 * uTime);
    r.y = fbm(uv + 1.0 * q + vec2(8.3, 2.8) + 0.05 * uTime);

    float f = fbm(uv + r);
    
    float luma = dot(uBgPrimary, vec3(0.299, 0.587, 0.114));
    vec3 color;
    
    if (luma > 0.5) {
      // Светлые темы (Light, Sepia, Green)
      color = mix(uBgPrimary, uBgSecondary, clamp(f * 1.5, 0.0, 1.0));
      vec3 wave = mix(uBgAccent, uFgAccent, 0.6);
      color = mix(color, wave, clamp((f * f) * 1.8, 0.0, 1.0));
      color = mix(color, uFgAccent, clamp(length(r.x) * 0.8, 0.0, 1.0) * 0.3);
    } else {
      // Тёмные темы (Dark, OLED)
      color = mix(uBgPrimary, uBgSecondary, clamp(f * 1.2, 0.0, 1.0));
      color = mix(color, uBgAccent, clamp((f * f) * 2.5, 0.0, 1.0));
      color = mix(color, uFgAccent, clamp(length(q) * 0.55, 0.0, 1.0));
      color = mix(color, uFgAccent, clamp(length(r.x) * 0.8, 0.0, 1.0));
    }
    
    // Приглушаем на 50% для мягкости
    color = mix(color, uBgPrimary, 0.50);
    
    gl_FragColor = vec4(color, 1.0);
  }
`

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

  glContext = gl

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
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1,
    -1,
    1,
    -1,
    -1,
    1,
    -1,
    1,
    1,
    -1,
    1,
    1,
  ]), gl.STATIC_DRAW)

  const posAttr = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(posAttr)
  gl.vertexAttribPointer(
    posAttr,
    2,
    gl.FLOAT,
    false,
    0,
    0,
  )

  const uTime = gl.getUniformLocation(program, 'uTime')
  uBgPrimaryLoc = gl.getUniformLocation(program, 'uBgPrimary')
  uBgSecondaryLoc = gl.getUniformLocation(program, 'uBgSecondary')
  uBgAccentLoc = gl.getUniformLocation(program, 'uBgAccent')
  uFgAccentLoc = gl.getUniformLocation(program, 'uFgAccent')

  updateColors()

  const stopWatch = watch(() => theme.value, () => {
    scheduleUpdateColors()
  }, { immediate: true })

  observer = new MutationObserver(() => {
    scheduleUpdateColors()
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })

  const resize = () => {
    if (!canvas)
      return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    gl.viewport(
      0,
      0,
      canvas.width,
      canvas.height,
    )
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
    stopWatch()
    if (observer)
      observer.disconnect()
    window.removeEventListener('resize', resize)
    if (animId)
      cancelAnimationFrame(animId)
  })
})
</script>

<template>
  <div class="onboarding-background-container">
    <canvas ref="canvasRef" class="bg-canvas" />
  </div>
</template>

<style lang="scss" scoped>
.onboarding-background-container {
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
  opacity: 0.45;
}
</style>
