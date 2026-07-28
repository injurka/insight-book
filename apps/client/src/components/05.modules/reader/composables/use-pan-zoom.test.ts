import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { usePanZoom } from './use-pan-zoom'

// Mounts a real DOM container/wrapper so that the composable attaches its
// listeners through the internal `watch(containerRef)` and we can dispatch
// genuine DOM events like the browser would.
function setupPanZoom() {
  let api!: ReturnType<typeof usePanZoom>
  const containerRef = ref<HTMLElement | null>(null)
  const wrapperRef = ref<HTMLElement | null>(null)

  const Host = defineComponent({
    setup() {
      api = usePanZoom(containerRef, wrapperRef)
      return { containerRef, wrapperRef }
    },
    template: `<div ref="containerRef"><div ref="wrapperRef" /></div>`,
  })

  const wrapper = mount(Host, { attachTo: document.body })
  return { api, wrapper, container: containerRef.value!, wrapperEl: wrapperRef.value! }
}

function wheel(el: HTMLElement, init: { deltaX?: number, deltaY?: number, ctrlKey?: boolean, clientX?: number, clientY?: number }) {
  // happy-dom's WheelEvent extends UIEvent and ignores ctrlKey/clientX/clientY
  // in the init dict, so assign them manually.
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: init.deltaX, deltaY: init.deltaY })
  Object.defineProperty(event, 'ctrlKey', { value: init.ctrlKey ?? false })
  Object.defineProperty(event, 'clientX', { value: init.clientX ?? 0 })
  Object.defineProperty(event, 'clientY', { value: init.clientY ?? 0 })
  el.dispatchEvent(event)
}

function touch(el: HTMLElement, type: string, points: Array<{ clientX: number, clientY: number }>) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', { value: points })
  el.dispatchEvent(event)
}

describe('usePanZoom', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('starts with default scale/pan state', () => {
    const { api, wrapper } = setupPanZoom()
    expect(api.scale.value).toBe(1)
    expect(api.panX.value).toBe(0)
    expect(api.panY.value).toBe(0)
    expect(api.isPanning.value).toBe(false)
    expect(api.isPinching.value).toBe(false)
    wrapper.unmount()
  })

  it('zooms in on ctrl+wheel and adjusts pan around the cursor', async () => {
    const { api, wrapper, container } = setupPanZoom()
    await nextTick()

    // deltaY = -200 -> delta = 1 -> newScale = 1 * (1 + 1) = 2
    // getBoundingClientRect() returns zeros in happy-dom, so:
    // panX -= (100 - 0) * (2/1 - 1) = -100, panY -= 50
    wheel(container, { ctrlKey: true, deltaY: -200, clientX: 100, clientY: 50 })

    expect(api.scale.value).toBe(2)
    expect(api.panX.value).toBe(-100)
    expect(api.panY.value).toBe(-50)
    wrapper.unmount()
  })

  it('clamps scale to maxScale (5) on repeated zoom-in', async () => {
    const { api, wrapper, container } = setupPanZoom()
    await nextTick()

    for (let i = 0; i < 20; i++)
      wheel(container, { ctrlKey: true, deltaY: -1000, clientX: 0, clientY: 0 })

    expect(api.scale.value).toBe(5)
    wrapper.unmount()
  })

  it('clamps scale to minScale (1) and resets pan when zooming back out', async () => {
    const { api, wrapper, container } = setupPanZoom()
    await nextTick()

    wheel(container, { ctrlKey: true, deltaY: -200, clientX: 100, clientY: 50 })
    expect(api.scale.value).toBe(2)

    // zoom all the way back out
    for (let i = 0; i < 10; i++)
      wheel(container, { ctrlKey: true, deltaY: 500, clientX: 0, clientY: 0 })

    expect(api.scale.value).toBe(1)
    expect(api.panX.value).toBe(0)
    expect(api.panY.value).toBe(0)
    wrapper.unmount()
  })

  it('ignores plain wheel (no ctrl/meta) at scale 1', async () => {
    const { api, wrapper, container } = setupPanZoom()
    await nextTick()

    wheel(container, { deltaY: 120, deltaX: 10 })
    expect(api.scale.value).toBe(1)
    expect(api.panX.value).toBe(0)
    expect(api.panY.value).toBe(0)
    wrapper.unmount()
  })

  it('pans with plain wheel while zoomed in', async () => {
    const { api, wrapper, container } = setupPanZoom()
    await nextTick()

    wheel(container, { ctrlKey: true, deltaY: -200, clientX: 0, clientY: 0 })
    const panXBefore = api.panX.value
    const panYBefore = api.panY.value

    wheel(container, { deltaY: 30, deltaX: 15 })
    expect(api.panX.value).toBe(panXBefore - 15)
    expect(api.panY.value).toBe(panYBefore - 30)
    wrapper.unmount()
  })

  it('pans with mouse drag while zoomed in and tracks drag distance', async () => {
    const { api, wrapper, container } = setupPanZoom()
    await nextTick()

    wheel(container, { ctrlKey: true, deltaY: -200, clientX: 0, clientY: 0 })
    expect(api.scale.value).toBe(2)
    const startPanX = api.panX.value
    const startPanY = api.panY.value

    container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }))
    expect(api.isPanning.value).toBe(true)

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 30, clientY: 45 }))
    // startPanX = 10 - panX, so newPanX = 30 - (10 - panX) = panX + 20
    expect(api.panX.value).toBe(startPanX + 20)
    expect(api.panY.value).toBe(startPanY + 35)
    expect(api.dragDist.value).toBe(55)

    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(api.isPanning.value).toBe(false)
    wrapper.unmount()
  })

  it('does not start mouse pan at scale 1', async () => {
    const { api, wrapper, container } = setupPanZoom()
    await nextTick()

    container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50 }))
    expect(api.isPanning.value).toBe(false)
    expect(api.panX.value).toBe(0)
    expect(api.panY.value).toBe(0)
    wrapper.unmount()
  })

  it('pinch zooms between two touch points within limits', async () => {
    const { api, wrapper, container } = setupPanZoom()
    await nextTick()

    touch(container, 'touchstart', [
      { clientX: 0, clientY: 0 },
      { clientX: 100, clientY: 0 },
    ])
    expect(api.isPinching.value).toBe(true)

    // distance doubles 100 -> 200, so scale = 1 * 2 = 2
    touch(container, 'touchmove', [
      { clientX: 0, clientY: 0 },
      { clientX: 200, clientY: 0 },
    ])
    expect(api.scale.value).toBe(2)

    // shrink far below the initial distance -> clamps back to minScale
    touch(container, 'touchmove', [
      { clientX: 0, clientY: 0 },
      { clientX: 10, clientY: 0 },
    ])
    expect(api.scale.value).toBe(1)
    expect(api.panX.value).toBe(0)
    expect(api.panY.value).toBe(0)

    touch(container, 'touchend', [])
    expect(api.isPinching.value).toBe(false)
    wrapper.unmount()
  })

  it('pans with a single touch while zoomed in', async () => {
    const { api, wrapper, container } = setupPanZoom()
    await nextTick()

    wheel(container, { ctrlKey: true, deltaY: -200, clientX: 0, clientY: 0 })
    const startPanX = api.panX.value
    const startPanY = api.panY.value

    touch(container, 'touchstart', [{ clientX: 10, clientY: 10 }])
    expect(api.isPanning.value).toBe(true)

    touch(container, 'touchmove', [{ clientX: 40, clientY: 25 }])
    expect(api.panX.value).toBe(startPanX + 30)
    expect(api.panY.value).toBe(startPanY + 15)
    expect(api.dragDist.value).toBe(45)

    touch(container, 'touchend', [])
    expect(api.isPanning.value).toBe(false)
    wrapper.unmount()
  })

  it('resetZoom restores the initial state', async () => {
    const { api, wrapper, container } = setupPanZoom()
    await nextTick()

    wheel(container, { ctrlKey: true, deltaY: -400, clientX: 80, clientY: 60 })
    container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 30, clientY: 30 }))
    expect(api.scale.value).not.toBe(1)

    api.resetZoom()
    expect(api.scale.value).toBe(1)
    expect(api.panX.value).toBe(0)
    expect(api.panY.value).toBe(0)
    expect(api.isPanning.value).toBe(false)
    expect(api.isPinching.value).toBe(false)
    expect(api.dragDist.value).toBe(0)
    wrapper.unmount()
  })

  it('removes window mouse listeners on unmount', async () => {
    const { api, wrapper, container } = setupPanZoom()
    await nextTick()

    wheel(container, { ctrlKey: true, deltaY: -200, clientX: 0, clientY: 0 })
    expect(api.scale.value).toBe(2)

    container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 }))
    expect(api.isPanning.value).toBe(true)

    wrapper.unmount()

    const panXBefore = api.panX.value
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 50 }))
    expect(api.panX.value).toBe(panXBefore)
  })

  it('removes element listeners on unmount', async () => {
    const { api, wrapper, container } = setupPanZoom()
    await nextTick()

    wheel(container, { ctrlKey: true, deltaY: -200, clientX: 0, clientY: 0 })
    expect(api.scale.value).toBe(2)

    wrapper.unmount()
    wheel(container, { ctrlKey: true, deltaY: -200, clientX: 0, clientY: 0 })
    expect(api.scale.value).toBe(2)
  })
})
