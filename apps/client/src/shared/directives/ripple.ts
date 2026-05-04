const ripple = {
  mounted(el: HTMLElement) {
    el.style.position = 'relative'
    el.style.overflow = 'hidden'

    el.addEventListener('click', (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const circle = document.createElement('span')
      const diameter = Math.max(rect.width, rect.height)
      const radius = diameter / 2

      circle.style.width = circle.style.height = `${diameter}px`
      circle.style.left = `${x - radius}px`
      circle.style.top = `${y - radius}px`
      circle.style.position = 'absolute'
      circle.style.borderRadius = '50%'
      circle.style.transform = 'scale(0)'
      circle.style.animation = 'ripple 600ms linear'
      circle.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'
      circle.style.pointerEvents = 'none'

      const existingRipple = el.getElementsByClassName('ripple')[0]
      if (existingRipple) {
        existingRipple.remove()
      }

      circle.classList.add('ripple')
      el.appendChild(circle)

      setTimeout(() => {
        circle.remove()
      }, 600)
    })

    // Add keyframes styles programmatically if not exists
    if (!document.getElementById('ripple-style')) {
      const style = document.createElement('style')
      style.id = 'ripple-style'
      style.innerHTML = `
        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
      `
      document.head.appendChild(style)
    }
  },
}

export const vRipple = ripple
