export enum AppRouteNames {
  Home = 'home',
  BookInfo = 'book-info',
  Reader = 'reader',
  Dictionary = 'dictionary',
  Settings = 'settings',
  Limits = 'limits',
  SignIn = 'sign-in',
  Notebook = 'notebook',
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

  //
  YandexCallback: '/auth/yandex/callback',

}
