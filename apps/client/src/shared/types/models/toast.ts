export type ToastTypes = 'error' | 'success' | 'warn' | 'info'

export interface ToastMessage {
  id: string
  type: ToastTypes
  detail: string
  expire: number
  swipeToClose: boolean
  group?: string
}

export type ToastOptions = Omit<Partial<ToastMessage>, 'id' | 'detail'>

export interface ToastApi {
  add: (message: Omit<Partial<ToastMessage>, 'id'>) => void
  remove: (id: string) => void
  success: (detail: string, options?: ToastOptions) => void
  error: (detail: string, options?: ToastOptions) => void
  warn: (detail: string, options?: ToastOptions) => void
  info: (detail: string, options?: ToastOptions) => void
}
