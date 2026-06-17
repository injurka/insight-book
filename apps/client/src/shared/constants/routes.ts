export enum AppRouteNames {
  Home = 'home',
  BookInfo = 'book-info',
  Reader = 'reader',
  Dictionary = 'dictionary',
  Settings = 'settings',
  SignIn = 'sign-in',
  //
  YandexCallback = 'yandex-callback',
}

export const AppRoutePaths = {
  Home: '/',
  Dictionary: '/dictionary',
  Reader: '/reader',
  Settings: '/settings',
  SignIn: '/sign-in',
  Book: {
    Info: (id: string | number) => `/book/${id}`,
  },

  //
  YandexCallback: '/auth/yandex/callback',

}
