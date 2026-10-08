import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../store/toast.store'
import { useToast } from './use-toast'

vi.mock('~/01.shared/composables/use-tracking', () => ({ useTracking: () => ({ trackEvent: vi.fn() }) }))

describe('useToast', () => {
  it('returns the shared store with its complete notification API', () => {
    setActivePinia(createPinia())
    const toast = useToast()
    expect(toast).toBe(useToastStore())
    toast.success('Saved', { expire: 0 })
    toast.error('Failed', { expire: 0 })
    toast.info('Info', { expire: 0 })
    toast.warn('Warning', { expire: 0 })
    expect(useToast().messages.map(message => message.type)).toEqual(['success', 'error', 'info', 'warn'])
    toast.remove(toast.messages[0].id)
    expect(toast.messageCount).toBe(3)
  })
})
