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
  About = 'about',
  Copyright = 'copyright',
  Privacy = 'privacy',
  Offer = 'offer',
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
  About: '/about',
  Copyright: '/copyright',
  Privacy: '/privacy',
  Offer: '/offer',
  Book: {
    Info: (id: string | number) => `/book/${id}`,
  },
  Onboarding: '/onboarding',
  //
  YandexCallback: '/auth/yandex/callback',

}
