import type { Ref } from 'vue'
import { getCurrentInstance, onUnmounted, watch } from 'vue'

// Глобальный стейт для отслеживания порядка открытия модалок
const openModalsStack: string[] = []
const scrollLocks = new Set<string>()
let previousOverflow = ''

export function setDialogScrollLock(dialogId: string, locked: boolean) {
  if (typeof document === 'undefined')
    return

  if (locked) {
    if (scrollLocks.size === 0)
      previousOverflow = document.body.style.overflow

    scrollLocks.add(dialogId)
    document.body.style.overflow = 'hidden'
  }
  else if (scrollLocks.delete(dialogId) && scrollLocks.size === 0) {
    document.body.style.overflow = previousOverflow
  }
}
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
  const isTopDialog = () => openModalsStack.at(-1) === dialogId

  function handlePopState() {
    if (isProgrammaticBack)
      return

    // Закрываем только ту модалку, которая находится на самом верху стека
    if (isTopDialog()) {
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

  return { isTopDialog }
}
