import { z } from 'zod'

/**
 * Обертка ACL (Anti-Corruption Layer).
 * Валидирует и трансформирует сырые данные (API / offline-кэш) по Zod-схеме.
 * При нарушении контракта логирует ошибку и выбрасывает понятную доменную ошибку.
 */
export function applyAcl<T>(schema: z.ZodType<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data)

  if (result.success)
    return result.data

  // Здесь можно отправлять логи в Sentry / Umami о том, что контракт нарушен
  console.error(`[ACL Error] Contract mismatch in ${context}:`, z.treeifyError(result.error))

  throw new Error(`Data validation failed in ${context}`)
}
