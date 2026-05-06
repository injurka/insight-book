import { useToastStore } from '~/shared/store/toast.store'

/**
 * Composable для доступа к API уведомлений (тостов).
 * @example
 * const toast = useToast()
 * toast.success('Профиль успешно обновлен!')
 */
export function useToast() {
  return useToastStore()
}
