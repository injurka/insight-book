<script setup lang="ts">
import type { CharacterData } from '../../../../data'
import type { BurstEvent } from '../../lib/use-scroll-drag'
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  isDragging: boolean
  dragChar: CharacterData | null
  dragPos: { x: number, y: number }
  dragRotation: number
  dragTiltX: number
  dragTiltY: number
  dragScale: number
  burstEvent: BurstEvent | null
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animId: number | null = null

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  decay: number
  color: string
}

const activeBursts: Array<{ particles: Particle[], char: string, x: number, y: number, alpha: number }> = []

watch(() => props.burstEvent, (ev) => {
  if (!ev)
    return
  triggerInkBurst(ev.x, ev.y, ev.char)
})

function triggerInkBurst(x: number, y: number, char: string) {
  const count = 28
  const particles: Particle[] = []
  const colors = ['#f59e0b', '#fbbf24', '#d97706', '#ffffff']

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = Math.random() * 6 + 2
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: Math.random() * 3 + 1.5,
      alpha: 1,
      decay: Math.random() * 0.03 + 0.015,
      color: colors[Math.floor(Math.random() * colors.length)],
    })
  }

  activeBursts.push({
    particles,
    char,
    x,
    y,
    alpha: 1,
  })

  if (!animId) {
    loopBursts()
  }
}

function loopBursts() {
  const canvas = canvasRef.value
  if (!canvas)
    return

  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (let i = activeBursts.length - 1; i >= 0; i--) {
    const burst = activeBursts[i]
    burst.alpha -= 0.025

    burst.particles.forEach((p) => {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.1 // gravity
      p.alpha -= p.decay

      if (p.alpha > 0) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = Math.max(0, p.alpha)
        ctx.shadowColor = '#f59e0b'
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.restore()
      }
    })

    if (burst.alpha > 0) {
      ctx.save()
      ctx.font = 'bold 24px serif'
      ctx.fillStyle = '#fbbf24'
      ctx.globalAlpha = Math.max(0, burst.alpha)
      ctx.textAlign = 'center'
      ctx.fillText(burst.char, burst.x, burst.y - (1 - burst.alpha) * 30)
      ctx.restore()
    }

    if (burst.alpha <= 0) {
      activeBursts.splice(i, 1)
    }
  }

  if (activeBursts.length > 0) {
    animId = requestAnimationFrame(loopBursts)
  }
  else {
    animId = null
  }
}

onBeforeUnmount(() => {
  if (animId) {
    cancelAnimationFrame(animId)
  }
})
</script>

<template>
  <div class="drag-preview-layer">
    <!-- Overlay Canvas for Ink Particle Bursts -->
    <canvas ref="canvasRef" class="burst-canvas" />

    <!-- Physics Dragged Floating Card -->
    <div
      v-if="isDragging && dragChar"
      class="floating-drag-card"
      :style="{
        left: `${dragPos.x}px`,
        top: `${dragPos.y}px`,
        transform: `translate(-50%, -50%) rotate(${dragRotation}deg) rotateX(${dragTiltY}deg) rotateY(${dragTiltX}deg) scale(${dragScale})`,
      }"
    >
      <div class="drag-char">
        {{ dragChar.char }}
      </div>
      <div class="drag-pinyin">
        {{ dragChar.pinyin }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.drag-preview-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 100;
}

.burst-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.floating-drag-card {
  position: absolute;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.95);
  border: 2px solid #fbbf24;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(251, 191, 36, 0.5);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform-origin: center center;
  will-change: transform, left, top;

  .drag-char {
    font-size: 2rem;
    color: #fef08a;
    line-height: 1;
    font-weight: 500;
    text-shadow: 0 0 10px rgba(245, 158, 11, 0.8);
  }

  .drag-pinyin {
    font-size: 0.65rem;
    color: #94a3b8;
    font-family: monospace;
  }
}
</style>
