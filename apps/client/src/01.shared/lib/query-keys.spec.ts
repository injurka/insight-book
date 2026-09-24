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
