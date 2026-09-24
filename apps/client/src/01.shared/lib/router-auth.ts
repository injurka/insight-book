import { AppRouteNames } from '~/01.shared/constants/routes'

const protectedRouteNames = new Set<AppRouteNames>([
  AppRouteNames.Dictionary,
  AppRouteNames.Reader,
  AppRouteNames.Settings,
  AppRouteNames.Limits,
  AppRouteNames.Notebook,
])

export function shouldWaitForAuth(toName: string | symbol | null | undefined, isAuthReady: boolean, isAuthRefreshing: boolean): boolean {
  return !isAuthReady || (isAuthRefreshing && protectedRouteNames.has(toName as AppRouteNames))
}
