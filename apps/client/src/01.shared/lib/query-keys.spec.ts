import { describe, expect, it } from 'vitest'
import { queryKeys, scopedQueryKey, setAuthQueryScope } from './query-keys'

describe('scoped query keys', () => {
  it('keeps the same scope during an auth refresh for the same identity', () => {
    setAuthQueryScope('stable-user')
    const firstKey = scopedQueryKey(queryKeys.dictionary.all)

    setAuthQueryScope('stable-user')

    expect(scopedQueryKey(queryKeys.dictionary.all)).toEqual(firstKey)
  })

  it('rotates user-backed query entries when the auth identity changes', () => {
    setAuthQueryScope('user-1')
    const firstUserKey = scopedQueryKey(queryKeys.dictionary.all)

    setAuthQueryScope('user-2')
    const secondUserKey = scopedQueryKey(queryKeys.dictionary.all)

    expect(firstUserKey.slice(0, -1)).toEqual(['dictionary'])
    expect(secondUserKey.slice(0, -1)).toEqual(['dictionary'])
    expect(firstUserKey).not.toEqual(secondUserKey)
  })

  it('keeps the same key when the same identity is set repeatedly', () => {
    setAuthQueryScope('user-1')
    const first = scopedQueryKey(queryKeys.dictionary.all)

    setAuthQueryScope('user-1')
    const second = scopedQueryKey(queryKeys.dictionary.all)

    expect(second).toEqual(first)
  })

  it('rotates again after a logout/login cycle with the same user', () => {
    setAuthQueryScope('user-1')
    const beforeLogout = scopedQueryKey(queryKeys.dictionary.all)

    setAuthQueryScope(null)
    setAuthQueryScope('user-1')
    const afterRelogin = scopedQueryKey(queryKeys.dictionary.all)

    expect(afterRelogin).not.toEqual(beforeLogout)
  })
})

describe('query key factories', () => {
  it('keeps root keys and ID keys consistent, including ID zero', () => {
    expect(queryKeys.books()).toEqual(queryKeys.books.all)
    expect(queryKeys.books(null)).toEqual(queryKeys.books.all)
    expect(queryKeys.books(0)).toEqual(queryKeys.books.byId(0))
    expect(queryKeys.books.public()).toEqual(['books', 'public', null])
    expect(queryKeys.books.public({ page: 2 })).toEqual(['books', 'public', { page: 2 }])
    expect(queryKeys.decks()).toEqual(queryKeys.decks.all)
    expect(queryKeys.dictionary()).toEqual(queryKeys.dictionary.all)

    for (const factory of [queryKeys.highlights, queryKeys.toc]) {
      expect(factory()).toEqual(factory.all)
      expect(factory(null)).toEqual(factory.all)
    }

    expect(queryKeys.highlights(1)).toEqual(queryKeys.highlights.byBookId(1))
    expect(queryKeys.toc(1)).toEqual(queryKeys.toc.byBookId(1))
    expect(new Set(Object.values(queryKeys.plugins).map(key => JSON.stringify(key))).size).toBe(4)
  })
  it('does not mutate the input when adding an auth scope', () => {
    const key = ['books', 1] as const
    expect(scopedQueryKey(key).slice(0, -1)).toEqual(key)
    expect(key).toEqual(['books', 1])
  })
})
