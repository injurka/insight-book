export enum AppRouteNames {
  Home = 'home',
  BookInfo = 'book-info',
  Reader = 'reader',
  Dictionary = 'dictionary',
  Settings = 'settings',
  Limits = 'limits',
  SignIn = 'sign-in',
  Notebook = 'notebook',
  Onboarding = 'onboarding',
  //
  YandexCallback = 'yandex-callback',
}

export const AppRoutePaths = {
  Home: '/',
  Dictionary: '/dictionary',
  Reader: '/reader',
  Settings: '/settings',
  Limits: '/limits',
  SignIn: '/sign-in',
  Notebook: '/notebook',
  Book: {
    Info: (id: string | number) => `/book/${id}`,
  },
  Onboarding: '/onboarding',
  //
  YandexCallback: '/auth/yandex/callback',

}
