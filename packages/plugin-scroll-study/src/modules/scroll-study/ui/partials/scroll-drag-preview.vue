<script setup lang="ts">
import type { CharacterData } from '../../../../data'
import type { BurstEvent } from '../../lib/use-scroll-drag'
import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { onBeforeUnmount, watch } from 'vue'
import { usePixiLayer } from '../../lib/use-shared-pixi'

interface Props {
  isDragging: boolean
  dragChar: CharacterData | null
  dragPos: { x: number, y: number }
  dragRotation: number
  dragTiltX: number
  dragTiltY: number
  dragScale: number
  burstEvent: BurstEvent | null
}

interface QiSpark {
  gfx: Graphics
  vx: number
  vy: number
  alpha: number
  decay: number
  radius: number
}

interface BurstInstance {
  sparks: QiSpark[]
  text?: Text
  ring?: Graphics
  ringRadius: number
  ringAlpha: number
  alpha: number
  x: number
  y: number
}

const props = defineProps<Props>()
const { app, layer, isReady } = usePixiLayer('dragLayer')

let trailContainer: Container | null = null
let burstContainer: Container | null = null

const activeSparks: QiSpark[] = []
const activeBursts: BurstInstance[] = []

const stopWatch = watch([isReady, app], ([ready, pixi]) => {
  if (!ready || !pixi || trailContainer)
    return

  trailContainer = new Container({ label: 'dragTrail' })
  burstContainer = new Container({ label: 'dragBurst' })
  layer.addChild(trailContainer)
  layer.addChild(burstContainer)

  pixi.ticker.add(() => {
    // 1. Spawn drag trail embers if user is dragging card
    if (props.isDragging && trailContainer) {
      const colors = [0xfbbf24, 0xf59e0b, 0xffffff, 0xd97706]
      const count = 2
      for (let i = 0; i < count; i++) {
        const radius = Math.random() * 2.5 + 1.5
        const color = colors[Math.floor(Math.random() * colors.length)]

        const gfx = new Graphics()
          .circle(0, 0, radius)
          .fill({ color, alpha: 0.9 })

        gfx.blendMode = 'add'
        gfx.x = props.dragPos.x + (Math.random() - 0.5) * 36
        gfx.y = props.dragPos.y + (Math.random() - 0.5) * 36

        trailContainer.addChild(gfx)

        activeSparks.push({
          gfx,
          vx: (Math.random() - 0.5) * 1.5,
          vy: Math.random() * 1.5 + 0.5,
          alpha: 1,
          decay: Math.random() * 0.04 + 0.02,
          radius,
        })
      }
    }

    // 2. Animate trailing sparks
    for (let i = activeSparks.length - 1; i >= 0; i--) {
      const spark = activeSparks[i]
      spark.gfx.x += spark.vx
      spark.gfx.y += spark.vy
      spark.alpha -= spark.decay

      if (spark.alpha <= 0) {
        spark.gfx.destroy()
        activeSparks.splice(i, 1)
      }
      else {
        spark.gfx.alpha = spark.alpha
        spark.gfx.scale.set(spark.alpha)
      }
    }

    // 3. Animate burst instances
    for (let i = activeBursts.length - 1; i >= 0; i--) {
      const burst = activeBursts[i]
      burst.alpha -= 0.02

      burst.sparks.forEach((sp) => {
        sp.gfx.x += sp.vx
        sp.gfx.y += sp.vy
        sp.vy += 0.12
        sp.alpha -= sp.decay

        if (sp.alpha > 0) {
          sp.gfx.alpha = Math.max(0, sp.alpha)
          sp.gfx.scale.set(Math.max(0.2, sp.alpha))
        }
        else {
          sp.gfx.visible = false
        }
      })

      if (burst.ring && burst.ringAlpha > 0) {
        burst.ringRadius += 3.5
        burst.ringAlpha -= 0.04
        burst.ring.clear()
          .circle(0, 0, burst.ringRadius)
          .stroke({ width: 2, color: 0xfbbf24, alpha: Math.max(0, burst.ringAlpha) })
      }

      if (burst.text) {
        burst.text.y -= 0.8
        burst.text.alpha = Math.max(0, burst.alpha)
      }

      if (burst.alpha <= 0) {
        burst.sparks.forEach(sp => sp.gfx.destroy())
        if (burst.ring)
          burst.ring.destroy()
        if (burst.text)
          burst.text.destroy()
        activeBursts.splice(i, 1)
      }
    }
  })
}, { immediate: true })

watch(() => props.burstEvent, (ev) => {
  if (!ev || !burstContainer)
    return
  triggerPixiBurst(ev.x, ev.y, ev.char)
})

function triggerPixiBurst(x: number, y: number, char: string) {
  if (!burstContainer)
    return

  const count = 32
  const sparks: QiSpark[] = []
  const colors = [0xf59e0b, 0xfbbf24, 0xd97706, 0xffffff]

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = Math.random() * 7 + 2.5
    const radius = Math.random() * 3.5 + 2

    const gfx = new Graphics()
      .circle(0, 0, radius)
      .fill({ color: colors[Math.floor(Math.random() * colors.length)], alpha: 1 })

    gfx.blendMode = 'add'
    gfx.x = x
    gfx.y = y

    burstContainer.addChild(gfx)

    sparks.push({
      gfx,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      decay: Math.random() * 0.03 + 0.015,
      radius,
    })
  }

  const ring = new Graphics()
  ring.blendMode = 'add'
  ring.x = x
  ring.y = y
  burstContainer.addChild(ring)

  const textStyle = new TextStyle({
    fontFamily: 'serif',
    fontSize: 28,
    fontWeight: 'bold',
    fill: '#fbbf24',
    dropShadow: {
      color: '#f59e0b',
      blur: 8,
      distance: 0,
    },
  })
  const text = new Text({ text: char, style: textStyle })
  text.anchor.set(0.5, 0.5)
  text.x = x
  text.y = y - 10
  burstContainer.addChild(text)

  activeBursts.push({
    sparks,
    ring,
    text,
    ringRadius: 10,
    ringAlpha: 1,
    alpha: 1,
    x,
    y,
  })
}

onBeforeUnmount(() => {
  stopWatch()
  if (trailContainer) {
    trailContainer.destroy({ children: true })
    trailContainer = null
  }
  if (burstContainer) {
    burstContainer.destroy({ children: true })
    burstContainer = null
  }
})
</script>

<template>
  <div class="drag-preview-layer">
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


