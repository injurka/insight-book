import type { Ref } from 'vue'
import { getCurrentInstance, onUnmounted, watch } from 'vue'

// Глобальный стейт для отслеживания порядка открытия модалок
const openModalsStack: string[] = []
let isProgrammaticBack = false
let isUnloading = false

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    isUnloading = true
  })
  window.addEventListener('pagehide', () => {
    isUnloading = true
  })
}

export function useDialogHistory(dialogId: string, visible: Ref<boolean>) {
  function handlePopState() {
    if (isProgrammaticBack)
      return

    // Закрываем только ту модалку, которая находится на самом верху стека
    if (openModalsStack[openModalsStack.length - 1] === dialogId) {
      if (visible.value)
        visible.value = false
    }
  }

  function cleanupHistory() {
    if (typeof window === 'undefined')
      return

    const idx = openModalsStack.indexOf(dialogId)
    if (idx > -1)
      openModalsStack.splice(idx, 1)

    window.removeEventListener('popstate', handlePopState)

    // Если закрытие вызвано не кнопкой "Назад" и страница не выгружается
    if (!isUnloading && window.history.state && window.history.state.dialogId === dialogId) {
      isProgrammaticBack = true
      window.history.back()
      setTimeout(() => {
        isProgrammaticBack = false
      }, 50)
    }
  }

  watch(visible, (isOpen) => {
    if (typeof window === 'undefined')
      return

    if (isOpen) {
      openModalsStack.push(dialogId)
      const currentState = window.history.state || {}
      window.history.pushState({ ...currentState, isModal: true, dialogId }, '')
      window.addEventListener('popstate', handlePopState)
    }
    else {
      cleanupHistory()
    }
  }, { immediate: true })

  if (getCurrentInstance()) {
    onUnmounted(() => {
      cleanupHistory()
    })
  }
}
