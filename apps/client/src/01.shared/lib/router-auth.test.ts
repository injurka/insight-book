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

it('classifies all protected routes consistently and ignores unknown names', async () => {
  const { isProtectedRoute } = await import('./router-auth')

  for (const name of [AppRouteNames.Dictionary, AppRouteNames.Reader, AppRouteNames.Settings, AppRouteNames.Limits, AppRouteNames.Notebook]) {
    expect(isProtectedRoute(name)).toBe(true)
    expect(shouldWaitForAuth(name, true, true)).toBe(true)
    expect(shouldWaitForAuth(name, true, false)).toBe(false)
  }

  for (const name of [AppRouteNames.Home, undefined, null, Symbol('route'), 'unknown']) {
    expect(isProtectedRoute(name)).toBe(false)
    expect(shouldWaitForAuth(name, false, false)).toBe(true)
    expect(shouldWaitForAuth(name, true, true)).toBe(false)
  }
})
