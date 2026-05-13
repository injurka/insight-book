export enum AppRouteNames {
  Home = 'home',
  BookInfo = 'book-info',
  Reader = 'reader',
  Dictionary = 'dictionary',
  Settings = 'settings',
  Login = 'login',
}

export const AppRoutePaths = {
  Home: '/',
  Dictionary: '/dictionary',
  Reader: '/reader',
  Settings: '/settings',
  Login: '/login',

  Book: {
    Info: (id: string | number) => `/book/${id}`,
  },
}
