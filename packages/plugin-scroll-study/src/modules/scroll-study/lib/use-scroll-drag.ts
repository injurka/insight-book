import type { CharacterData } from '../../../data'
import { reactive, ref, watch } from 'vue'
import { useScrollStudyStore } from '../model/scroll-study.store'
import { playUiSound } from './ui-sound'

export interface BurstEvent {
  x: number
  y: number
  char: string
  timestamp: number
}

export function useScrollDrag() {
  const scrollStore = useScrollStudyStore()

  const isPointerDragging = ref(false)
  const dragChar = ref<CharacterData | null>(null)
  const dragPos = reactive({ x: 0, y: 0 })
  const dragRotation = ref(0)
  const dragTiltX = ref(0)
  const dragTiltY = ref(0)
  const dragScale = ref(1)

  const burstEvent = ref<BurstEvent | null>(null)

  watch(isPointerDragging, (dragging) => {
    if (dragging) {
      document.body.classList.add('dragging-active')
    }
    else {
      document.body.classList.remove('dragging-active')
    }
  })

  let startX = 0
  let startY = 0
  let lastX = 0
  let lastY = 0
  let velX = 0
  let velY = 0
  let animFrameId: number | null = null

  function updatePhysics() {
    if (!isPointerDragging.value)
      return

    const targetRotZ = Math.max(-45, Math.min(45, velX * 3.5))
    const targetRotX = Math.max(-35, Math.min(35, -velY * 3.0))
    const targetRotY = Math.max(-30, Math.min(30, velX * 2.2))

    dragRotation.value += (targetRotZ - dragRotation.value) * 0.3
    dragTiltY.value += (targetRotX - dragTiltY.value) * 0.3
    dragTiltX.value += (targetRotY - dragTiltX.value) * 0.3

    velX *= 0.8
    velY *= 0.8

    animFrameId = requestAnimationFrame(updatePhysics)
  }

  function triggerBurstEffect(x: number, y: number, symbol: string) {
    burstEvent.value = {
      x,
      y,
      char: symbol,
      timestamp: Date.now(),
    }
  }

  function placeDraggedCharacter(symbol: string, x: number, y: number): boolean {
    const targetEl = document.elementFromPoint(x, y)
    const nodeId = targetEl?.closest('[data-node-id]')?.getAttribute('data-node-id')

    if (!nodeId) {
      return false
    }

    const targetNode = scrollStore.activeGrid.find(node => node.id === nodeId)

    if (!targetNode || targetNode.type !== 'empty' || scrollStore.isFinished) {
      return false
    }

    const action = scrollStore.handleNodeDrop(symbol, targetNode)

    if (action) {
      playUiSound(action)
    }

    return true
  }

  function onPointerDown(e: PointerEvent, item: CharacterData) {
    if (e.button !== 0 && e.pointerType === 'mouse')
      return

    scrollStore.selectedTablet = item.char

    // Touch uses tap-to-select, then tap-to-place so the palette can scroll naturally.
    if (e.pointerType === 'touch')
      return

    dragChar.value = item
    startX = e.clientX
    startY = e.clientY
    lastX = e.clientX
    lastY = e.clientY
    velX = 0
    velY = 0
    dragPos.x = e.clientX
    dragPos.y = e.clientY

    const onPointerMove = (moveEv: PointerEvent) => {
      const dist = Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY)

      if (!isPointerDragging.value && dist > 4) {
        isPointerDragging.value = true
        dragScale.value = 0.65

        if (!animFrameId) {
          animFrameId = requestAnimationFrame(updatePhysics)
        }
      }

      if (isPointerDragging.value) {
        const dx = moveEv.clientX - lastX
        const dy = moveEv.clientY - lastY
        lastX = moveEv.clientX
        lastY = moveEv.clientY

        velX = dx
        velY = dy

        dragPos.x = moveEv.clientX
        dragPos.y = moveEv.clientY

        const targetEl = document.elementFromPoint(moveEv.clientX, moveEv.clientY)
        const nodeEl = targetEl?.closest('[data-node-id]')
        const nodeId = nodeEl?.getAttribute('data-node-id') || null
        scrollStore.hoveredNodeId = nodeId
      }
    }

    const onPointerUp = (upEv: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)

      if (animFrameId) {
        cancelAnimationFrame(animFrameId)
        animFrameId = null
      }

      if (isPointerDragging.value && dragChar.value) {
        const symbol = dragChar.value.char
        const placed = placeDraggedCharacter(symbol, upEv.clientX, upEv.clientY)

        if (!placed) {
          triggerBurstEffect(upEv.clientX, upEv.clientY, dragChar.value.char)
        }
      }

      isPointerDragging.value = false
      dragChar.value = null
      dragRotation.value = 0
      dragTiltX.value = 0
      dragTiltY.value = 0
      dragScale.value = 1
      scrollStore.hoveredNodeId = null
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  return {
    isPointerDragging,
    dragChar,
    dragPos,
    dragRotation,
    dragTiltX,
    dragTiltY,
    dragScale,
    burstEvent,
    onPointerDown,
  }
}
