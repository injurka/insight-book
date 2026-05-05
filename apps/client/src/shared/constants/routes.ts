export enum AppRouteNames {
  Home = 'home',
  BookInfo = 'book-info',
  Reader = 'reader',
  Dictionary = 'dictionary',
}

export const AppRoutePaths = {
  Home: '/',
  Dictionary: '/dictionary',
  Reader: '/reader',

  Book: {
    Info: (id: string | number) => `/book/${id}`,
  },
}
