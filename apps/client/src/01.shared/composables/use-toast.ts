import { useToastStore } from '~/01.shared/store/toast.store'

/**
 * Composable для доступа к API уведомлений (тостов).
 * @example
 * const toast = useToast()
 * toast.success('Профиль успешно обновлен!')
 */
export function useToast() {
  return useToastStore()
}
