import type { ToastMessage, ToastOptions } from '../types/models/toast'
import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { useUmami } from '~/01.shared/composables/use-umami'

export interface ToastState {
  messages: ToastMessage[]
}

export const useToastStore = defineStore('toast', {
  state: (): ToastState => ({
    messages: [],
  }),

  getters: {
    allMessages: (state): ToastMessage[] => state.messages,
    messageCount: (state): number => state.messages.length,
  },

  actions: {
    add(message: Omit<Partial<ToastMessage>, 'id'>) {
      if (this.messages.some(m => m.detail === message.detail && m.type === message.type))
        return

      const id = uuidv4()
      const defaults: ToastMessage = {
        id,
        type: 'info',
        detail: '',
        expire: 5000,
        swipeToClose: true,
      }

      const finalMessage = { ...defaults, ...message }
      this.messages.push(finalMessage)

      if (finalMessage.expire > 0)
        setTimeout(() => this.remove(id), finalMessage.expire)
    },

    remove(id: string) {
      const index = this.messages.findIndex((m: { id: string }) => m.id === id)
      if (index !== -1)
        this.messages.splice(index, 1)
    },

    success(detail: string, options: ToastOptions = {}) {
      this.add({ type: 'success', detail, ...options })
    },

    error(detail: string, options: ToastOptions = {}) {
      const { trackEvent } = useUmami()

      this.add({ type: 'error', detail, ...options })

      trackEvent('app_error', { message: detail })
    },

    info(detail: string, options: ToastOptions = {}) {
      this.add({ type: 'info', detail, ...options })
    },

    warn(detail: string, options: ToastOptions = {}) {
      this.add({ type: 'warn', detail, ...options })
    },
  },
})
