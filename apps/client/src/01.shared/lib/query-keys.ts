import type { EntryKey } from '@pinia/colada'
import { ref } from 'vue'

// Server-backed query data must not be shared between authenticated sessions.
// The scope is rotated by the auth store after restoring or changing identity;
// including it in the key also makes a logout/login cycle start with a fresh
// query entry instead of briefly rendering the previous user's data.
const authQueryScope = ref('anonymous:0')
let authQueryScopeRevision = 0
let authQueryIdentity: string | null = null

export function setAuthQueryScope(identity: string | null): void {
  if (authQueryIdentity === identity)
    return

  authQueryIdentity = identity
  authQueryScopeRevision++
  authQueryScope.value = `${identity || 'anonymous'}:${authQueryScopeRevision}`
}

export function scopedQueryKey(key: EntryKey): EntryKey {
  return [...key, authQueryScope.value]
}

export interface PublicBooksQueryParams {
  page?: number
  tag?: string
  search?: string
  lang?: string
}

export const queryKeys = {
  books: Object.assign((id?: number | null) => (id !== null && id !== undefined ? (['books', id] as const) : (['books'] as const)), {
    all: ['books'] as const,
    byId: (id: number | null) => ['books', id] as const,
    public: (params?: PublicBooksQueryParams) => ['books', 'public', params ?? null] as const,
  }),
  decks: Object.assign(() => ['decks'] as const, {
    all: ['decks'] as const,
  }),
  dictionary: Object.assign(() => ['dictionary'] as const, {
    all: ['dictionary'] as const,
  }),
  highlights: Object.assign((bookId?: number | null) => (bookId !== null && bookId !== undefined ? (['highlights', bookId] as const) : (['highlights'] as const)), {
    all: ['highlights'] as const,
    byBookId: (bookId: number | null) => ['highlights', bookId] as const,
  }),
  toc: Object.assign((bookId?: number | null) => (bookId !== null && bookId !== undefined ? (['toc', bookId] as const) : (['toc'] as const)), {
    all: ['toc'] as const,
    byBookId: (bookId: number | null) => ['toc', bookId] as const,
  }),
  plugins: {
    my: ['plugins', 'my'] as const,
    catalogApproved: ['plugins', 'catalog', 'approved'] as const,
    catalogMine: ['plugins', 'catalog', 'mine'] as const,
    catalogPending: ['plugins', 'catalog', 'pending'] as const,
  },
}

export const QUERY_KEYS = queryKeys
