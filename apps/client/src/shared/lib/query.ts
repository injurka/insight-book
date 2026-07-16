import type { UseQueryOptions, UseQueryReturn } from '@pinia/colada'
import { useQuery } from '@pinia/colada'

export type OfflineQueryStrategy = 'network-first' | 'offline-first'

export interface CreateOfflineQueryOptions<
  TData,
  TError = Error,
  TDataInitial extends TData | undefined = undefined,
> extends Omit<UseQueryOptions<TData, TError, TDataInitial>, 'query'> {
  /**
   * The function that fetches data from the API (network).
   */
  networkQuery: (
    context: Parameters<UseQueryOptions<TData, TError, TDataInitial>['query']>[0],
  ) => Promise<TData>

  /**
   * Function to retrieve cached data from the offline storage (localforage, Cache API, etc.).
   * Should return null or undefined if no cached data exists.
   */
  getOfflineData: (
    context: Parameters<UseQueryOptions<TData, TError, TDataInitial>['query']>[0],
  ) => Promise<TData | TDataInitial | null | undefined>

  /**
   * Function to persist successfully fetched data to the offline storage.
   * If omitted, saving data to offline storage is skipped.
   */
  saveOfflineData?: (
    data: TData,
    context: Parameters<UseQueryOptions<TData, TError, TDataInitial>['query']>[0],
  ) => Promise<void>

  /**
   * Caching strategy:
   * - 'network-first': Always attempt to fetch from the API first. If it fails, fall back to offline cache.
   * - 'offline-first': Look in offline cache first. If cache hit, return immediately. If cache miss, fetch from API.
   * @default 'network-first'
   */
  strategy?: OfflineQueryStrategy
}

/**
 * Creates an offline-capable Pinia Colada query helper.
 * Encapsulates offline storage fallback and cache-aside patterns.
 */
export function createOfflineQuery<
  TData,
  TError = Error,
  TDataInitial extends TData | undefined = undefined,
>(
  options: CreateOfflineQueryOptions<TData, TError, TDataInitial>,
): UseQueryReturn<TData, TError, TDataInitial> {
  const {
    networkQuery,
    getOfflineData,
    saveOfflineData,
    strategy = 'network-first',
    ...coladaOptions
  } = options

  return useQuery<TData, TError, TDataInitial>({
    ...coladaOptions,
    query: async (context) => {
      // 1. Offline-First (Cache-First) check
      if (strategy === 'offline-first') {
        try {
          const cached = await getOfflineData(context)
          if (cached !== null && cached !== undefined) {
            return cached as TData
          }
        }
        catch (cacheErr) {
          console.warn('[OfflineQuery] Failed to retrieve from offline cache:', cacheErr)
        }
      }

      // 2. Fetch from network
      try {
        const res = await networkQuery(context)

        // Save to offline storage on success
        if (saveOfflineData) {
          try {
            await saveOfflineData(res, context)
          }
          catch (saveErr) {
            console.warn('[OfflineQuery] Failed to save to offline cache:', saveErr)
          }
        }
        return res
      }
      catch (networkErr) {
        // 3. Network-First fallback check
        if (strategy === 'network-first') {
          try {
            const cached = await getOfflineData(context)
            if (cached !== null && cached !== undefined) {
              return cached as TData
            }
          }
          catch (cacheErr) {
            console.warn('[OfflineQuery] Failed to retrieve from offline cache on fallback:', cacheErr)
          }
        }
        // Re-throw error if network failed and no cache fallback succeeded
        throw networkErr
      }
    },
  })
}
