import { describe, expect, it } from 'vitest'
import { AppRouteNames } from '~/01.shared/constants/routes'
import { shouldWaitForAuth } from './router-auth'

describe('shouldWaitForAuth', () => {
  it('waits for an in-flight auth refresh before entering the reader', () => {
    expect(shouldWaitForAuth(AppRouteNames.Reader, true, true)).toBe(true)
  })

  it('does not delay public routes for a background refresh', () => {
    expect(shouldWaitForAuth(AppRouteNames.Home, true, true)).toBe(false)
  })

  it('still waits when auth has not been initialized', () => {
    expect(shouldWaitForAuth(AppRouteNames.Reader, false, false)).toBe(true)
  })
})
