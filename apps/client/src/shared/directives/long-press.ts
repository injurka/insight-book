import type { DirectiveBinding } from 'vue'

interface LongPressHTMLElement extends HTMLElement {
  _lpTimer?: ReturnType<typeof setTimeout>
  _lpMoved?: boolean
}

const longPress = {
  mounted(el: LongPressHTMLElement, binding: DirectiveBinding<(e: Event) => void>) {
    const duration = 800

    const start = (e: MouseEvent | TouchEvent) => {
      el._lpMoved = false
      el._lpTimer = setTimeout(() => {
        if (!el._lpMoved)
          binding.value(e)
      }, duration)
    }

    const cancel = () => {
      clearTimeout(el._lpTimer)
    }

    const move = () => {
      el._lpMoved = true
      cancel()
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
