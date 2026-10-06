<script setup lang="ts">
import type { CharacterData } from '../../../../data'
import type { BurstEvent } from '../../lib/use-scroll-drag'
import type { Ticker } from 'pixi.js'
import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { onBeforeUnmount, useTemplateRef, watch } from 'vue'
import { usePixiApp } from '../../lib/use-pixi-app'

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
const effectsHost = useTemplateRef<HTMLDivElement>('effectsHost')
const { app, isReady } = usePixiApp(effectsHost)

let trailContainer: Container | null = null
let burstContainer: Container | null = null

const activeSparks: QiSpark[] = []
const activeBursts: BurstInstance[] = []
let stopTicker: (() => void) | undefined
let emissionBudget = 0

function createSoftSpark(radius: number, color: number) {
  return new Graphics()
    .circle(0, 0, radius * 3).fill({ color, alpha: 0.04 })
    .circle(0, 0, radius * 2).fill({ color, alpha: 0.09 })
    .circle(0, 0, radius * 1.4).fill({ color, alpha: 0.18 })
    .circle(0, 0, radius).fill({ color, alpha: 0.45 })
    .circle(0, 0, radius * 0.4).fill({ color: 0xffedc2, alpha: 0.75 })
}

const stopWatch = watch([isReady, app], ([ready, pixi]) => {
  if (!ready || !pixi || trailContainer)
    return

  trailContainer = new Container({ label: 'dragTrail' })
  burstContainer = new Container({ label: 'dragBurst' })
  pixi.stage.addChild(trailContainer)
  pixi.stage.addChild(burstContainer)

  const animate = (ticker: Ticker) => {
    const delta = Math.min(ticker.deltaTime, 3)
    // 1. Spawn drag trail embers if user is dragging card
    if (props.isDragging && trailContainer) {
      const colors = [0xe8b456, 0xd2913e, 0xffd78a]
      emissionBudget += ticker.deltaMS * 0.035
      const count = Math.min(Math.floor(emissionBudget), 4)
      emissionBudget -= count
      for (let i = 0; i < count; i++) {
        const radius = Math.random() * 1.5 + 2
        const color = colors[Math.floor(Math.random() * colors.length)]

        const gfx = createSoftSpark(radius, color)

        gfx.blendMode = 'normal'
        gfx.x = props.dragPos.x + (Math.random() - 0.5) * 66
        gfx.y = props.dragPos.y + (Math.random() - 0.5) * 66

        trailContainer.addChild(gfx)

        activeSparks.push({
          gfx,
          vx: (Math.random() - 0.5) * 0.7,
          vy: Math.random() * 0.5 + 0.2,
          alpha: 1,
          decay: Math.random() * 0.003 + 0.008,
          radius,
        })
      }
    }

    // 2. Animate trailing sparks
    for (let i = activeSparks.length - 1; i >= 0; i--) {
      const spark = activeSparks[i]
      spark.gfx.x += spark.vx * delta
      spark.gfx.y += spark.vy * delta
      spark.alpha -= spark.decay * delta

      if (spark.alpha <= 0) {
        spark.gfx.destroy()
        activeSparks.splice(i, 1)
      }
      else {
        spark.gfx.alpha = spark.alpha
        spark.gfx.scale.set(0.65 + spark.alpha * 0.35)
      }
    }

    // 3. Animate burst instances
    for (let i = activeBursts.length - 1; i >= 0; i--) {
      const burst = activeBursts[i]
      burst.alpha -= 0.012 * delta

      burst.sparks.forEach((sp) => {
        sp.gfx.x += sp.vx * delta
        sp.gfx.y += sp.vy * delta
        sp.vy += 0.06 * delta
        sp.alpha -= sp.decay * delta

        if (sp.alpha > 0) {
          sp.gfx.alpha = Math.max(0, sp.alpha)
          sp.gfx.scale.set(Math.max(0.2, sp.alpha))
        }
        else {
          sp.gfx.visible = false
        }
      })

      if (burst.ring && burst.ringAlpha > 0) {
        burst.ringRadius += 2 * delta
        burst.ringAlpha -= 0.025 * delta
        burst.ring.clear()
          .circle(0, 0, burst.ringRadius)
          .stroke({ width: 2, color: 0xfbbf24, alpha: Math.max(0, burst.ringAlpha) })
      }

      if (burst.text) {
        burst.text.y -= 0.5 * delta
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
  }
  pixi.ticker.add(animate)
  stopTicker = () => {
    pixi.ticker?.remove(animate)
  }
}, { immediate: true })

watch(() => props.burstEvent, (ev) => {
  if (!ev || !burstContainer)
    return
  triggerPixiBurst(ev.x, ev.y, ev.char)
})

async function triggerPixiBurst(x: number, y: number, char: string) {
  await document.fonts.load('600 28px "Maple Mono CN"', char).catch(() => [])
  if (!burstContainer)
    return

  const count = 32
  const sparks: QiSpark[] = []
  const colors = [0xf59e0b, 0xfbbf24, 0xd97706, 0xffffff]

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = Math.random() * 3 + 1.5
    const radius = Math.random() * 3.5 + 2

    const gfx = createSoftSpark(radius, colors[Math.floor(Math.random() * colors.length)])

    gfx.blendMode = 'normal'
    gfx.x = x
    gfx.y = y

    burstContainer.addChild(gfx)

    sparks.push({
      gfx,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      decay: Math.random() * 0.004 + 0.012,
      radius,
    })
  }

  const ring = new Graphics()
  ring.blendMode = 'add'
  ring.x = x
  ring.y = y
  burstContainer.addChild(ring)

  const textStyle = new TextStyle({
    fontFamily: ['Maple Mono CN', 'monospace'],
    fontSize: 28,
    fontWeight: '600',
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
  stopTicker?.()
  if (trailContainer && !trailContainer.destroyed) {
    trailContainer.destroy({ children: true })
    trailContainer = null
  }
  if (burstContainer && !burstContainer.destroyed) {
    burstContainer.destroy({ children: true })
    burstContainer = null
  }
})
</script>

<template>
  <Teleport to="body">
  <div class="drag-preview-layer">
    <div ref="effectsHost" class="drag-effects" />
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
    </div>
  </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.drag-preview-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 100;
}

.drag-effects {
  position: absolute;
  inset: 0;

  :deep(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
}

.floating-drag-card {
  position: absolute;
  width: 64px;
  height: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform-origin: center center;
  will-change: transform, left, top;

  .drag-char {
    font-size: 2.5rem;
    color: #48250f;
    -webkit-text-stroke: 1.5px #fff0ce;
    paint-order: stroke fill;
    text-shadow: 0 2px 4px #24140880;
    line-height: 1;
    font-weight: 500;

  }


}
</style>


