import type { DirectiveBinding } from 'vue'

interface LongPressHTMLElement extends HTMLElement {
  _lpTimer?: ReturnType<typeof setTimeout>
  _lpMoved?: boolean
}

const longPress = {
  mounted(el: LongPressHTMLElement, binding: DirectiveBinding<(e: Event) => void>) {
    const duration = 600
    let startX = 0
    let startY = 0

    const start = (e: MouseEvent | TouchEvent) => {
      if (e.type === 'touchstart') {
        startX = (e as TouchEvent).touches[0].clientX
        startY = (e as TouchEvent).touches[0].clientY
      }
      else {
        startX = (e as MouseEvent).clientX
        startY = (e as MouseEvent).clientY
      }

      el._lpMoved = false
      el._lpTimer = setTimeout(() => {
        if (!el._lpMoved) {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(50)
          }
          binding.value(e)
        }
      }, duration)
    }

    const cancel = () => {
      if (el._lpTimer) {
        clearTimeout(el._lpTimer)
      }
    }

    const move = (e: MouseEvent | TouchEvent) => {
      if (!el._lpTimer || el._lpMoved)
        return

      let currentX = 0
      let currentY = 0

      if (e.type === 'touchmove') {
        currentX = (e as TouchEvent).touches[0].clientX
        currentY = (e as TouchEvent).touches[0].clientY
      }
      else {
        currentX = (e as MouseEvent).clientX
        currentY = (e as MouseEvent).clientY
      }

      const diffX = Math.abs(currentX - startX)
      const diffY = Math.abs(currentY - startY)

      if (diffX > 10 || diffY > 10) {
        el._lpMoved = true
        cancel()
      }
    }

    el.addEventListener('mousedown', start)
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('mouseup', cancel)
    el.addEventListener('mouseleave', cancel)
    el.addEventListener('touchend', cancel)
    el.addEventListener('mousemove', move)
    el.addEventListener('touchmove', move, { passive: true })
  },

  unmounted(el: LongPressHTMLElement) {
    el.removeEventListener('mousedown', () => { })
    el.removeEventListener('touchstart', () => { })
  },
}

export const vLongPress = longPress
