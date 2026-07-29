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
}

export const QUERY_KEYS = queryKeys
