export enum AppRouteNames {
  Home = 'home',
  BookInfo = 'book-info',
  Reader = 'reader',
  Dictionary = 'dictionary',
  Settings = 'settings',
}

export const AppRoutePaths = {
  Home: '/',
  Dictionary: '/dictionary',
  Reader: '/reader',
  Settings: '/settings',

  Book: {
    Info: (id: string | number) => `/book/${id}`,
  },
}
