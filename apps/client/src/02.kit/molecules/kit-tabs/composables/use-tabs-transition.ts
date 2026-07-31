import type { Ref } from 'vue'
import { ref, watch } from 'vue'

export function useTabsTransition(modelValue: Ref<string | number>, items: Ref<Array<{ id: string | number }>>, contentWrapperRef: Ref<HTMLElement | null>) {
  const transitionName = ref('slide-left')

  watch(modelValue, (newVal, oldVal) => {
    const newIndex = items.value.findIndex(item => item.id === newVal)
    const oldIndex = items.value.findIndex(item => item.id === oldVal)
    transitionName.value = newIndex > oldIndex ? 'slide-left' : 'slide-right'
  })

  function onBeforeLeave(el: Element) {
    if (contentWrapperRef.value) {
      const htmlEl = el as HTMLElement
      contentWrapperRef.value.style.height = `${htmlEl.offsetHeight}px`
    }
  }

  function onEnter(el: Element) {
    if (contentWrapperRef.value) {
      const htmlEl = el as HTMLElement
      requestAnimationFrame(() => {
        if (contentWrapperRef.value) {
          contentWrapperRef.value.style.height = `${htmlEl.offsetHeight}px`
        }
      })
    }
  }

  function onAfterEnter() {
    if (contentWrapperRef.value) {
      contentWrapperRef.value.style.height = 'auto'
    }
  }

  return {
    transitionName,
    onBeforeLeave,
    onEnter,
    onAfterEnter,
  }
}
