import type { DirectiveBinding } from 'vue'

interface LongPressHTMLElement extends HTMLElement {
  _lpTimer?: ReturnType<typeof setTimeout>
  _lpMoved?: boolean
  _onSelectionChange?: () => void
  _lpStart?: (e: MouseEvent | TouchEvent) => void
  _lpCancel?: () => void
  _lpMove?: (e: MouseEvent | TouchEvent) => void
}

const longPress = {
  mounted(el: LongPressHTMLElement, binding: DirectiveBinding<(e: Event) => void>) {
    const duration = 600
    let startX = 0
    let startY = 0

    const cancel = () => {
      if (el._lpTimer) {
        clearTimeout(el._lpTimer)
        el._lpTimer = undefined
      }
      if (el._onSelectionChange) {
        document.removeEventListener('selectionchange', el._onSelectionChange)
        el._onSelectionChange = undefined
      }
    }

    const start = (e: MouseEvent | TouchEvent) => {
      if (e.type === 'mousedown' && (e as MouseEvent).button !== 0)
        return

      if (e.type === 'touchstart') {
        startX = (e as TouchEvent).touches[0].clientX
        startY = (e as TouchEvent).touches[0].clientY
      }
      else {
        startX = (e as MouseEvent).clientX
        startY = (e as MouseEvent).clientY
      }

      el._lpMoved = false

      el._onSelectionChange = () => {
        const selection = window.getSelection()
        if (selection && selection.toString().trim().length > 0) {
          el._lpMoved = true
          cancel()
        }
      }
      document.addEventListener('selectionchange', el._onSelectionChange)

      el._lpTimer = setTimeout(() => {
        cancel()

        if (!el._lpMoved) {
          const selection = window.getSelection()
          if (selection && selection.toString().trim().length > 0) {
            return
          }

          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(50)
          }
          binding.value(e)
        }
      }, duration)
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

    el._lpStart = start
    el._lpCancel = cancel
    el._lpMove = move

    el.addEventListener('mousedown', start)
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('mouseup', cancel)
    el.addEventListener('mouseleave', cancel)
    el.addEventListener('touchend', cancel)
    el.addEventListener('mousemove', move)
    el.addEventListener('touchmove', move, { passive: true })
  },

  unmounted(el: LongPressHTMLElement) {
    if (el._lpCancel)
      el._lpCancel()
    if (el._lpStart) {
      el.removeEventListener('mousedown', el._lpStart)
      el.removeEventListener('touchstart', el._lpStart)
    }
    if (el._lpCancel) {
      el.removeEventListener('mouseup', el._lpCancel)
      el.removeEventListener('mouseleave', el._lpCancel)
      el.removeEventListener('touchend', el._lpCancel)
    }
    if (el._lpMove) {
      el.removeEventListener('mousemove', el._lpMove)
      el.removeEventListener('touchmove', el._lpMove)
    }
  },
}

export const vLongPress = longPress
