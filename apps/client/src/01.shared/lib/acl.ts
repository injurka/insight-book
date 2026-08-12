import { z } from 'zod'
import { trackError } from '~/01.shared/services/monitoring.service'

/**
 * Обертка ACL (Anti-Corruption Layer).
 * Валидирует и трансформирует сырые данные (API / offline-кэш) по Zod-схеме.
 * При нарушении контракта логирует ошибку и выбрасывает понятную доменную ошибку.
 */
export function applyAcl<T>(schema: z.ZodType<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data)

  if (result.success)
    return result.data

  const details = z.treeifyError(result.error)
  console.error(`[ACL Error] Contract mismatch in ${context}:`, details)

  const aclError = new Error(`[ACL Error] Contract mismatch in ${context}`)
  trackError(aclError, {
    context,
    details: typeof details === 'string' ? details : JSON.stringify(details),
  })

  throw aclError
}
