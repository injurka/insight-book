import type { InsightBookPlugin } from '../types'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import PluginSandbox from './plugin-sandbox.vue'

export interface CreateSandboxAppOptions {
  plugin: InsightBookPlugin
}

/**
 * Создает и настраивает Vue-приложение песочницы для тестирования и разработки плагина.
 * Автоматически инициализирует Pinia, vue-i18n и настраивает vue-router со всеми роутами страниц плагина.
 */
export function createSandboxApp({ plugin }: CreateSandboxAppOptions) {
  const app = createApp(PluginSandbox, { plugin })

  // Инициализация Pinia
  const pinia = createPinia()
  app.use(pinia)

  // Инициализация vue-i18n
  const i18n = createI18n({
    legacy: false,
    locale: 'ru',
    fallbackLocale: 'en',
    messages: {
      ru: {
        sandbox: {
          navigation: 'Навигация',
          pages: 'Страницы',
          widgets: 'Виджеты',
          logs: 'Логи API ({count})',
          noPages: 'У плагина нет открытых страниц.',
          selectWidget: 'Выберите виджет в боковой панели для просмотра.',
          customPosition: 'Позиция:',
          notifications: 'Уведомления',
          clear: 'Очистить',
          fullscreen: 'Полноэкранный режим (Esc)',
          activated: 'Активен',
          deactivated: 'Неактивен',
          unknown: 'Неизвестно',
          menu: 'Меню',
          exitFullscreen: 'Выйти из полноэкранного режима (Esc)',
          themeLight: 'Светлая тема',
          themeDark: 'Тёмная тема',
          noWidgets: 'Нет зарегистрированных виджетов',
          inspectorLogs: 'Инспектор и Логи',
          notificationsLog: 'Лог уведомлений',
          apiCallHistory: 'История вызовов API',
          noNotifications: 'Нет уведомлений',
          noApiCalls: 'История вызовов API пуста',
        },
      },
      en: {
        sandbox: {
          navigation: 'Navigation',
          pages: 'Pages',
          widgets: 'Widgets',
          logs: 'API Logs ({count})',
          noPages: 'No page components exposed by plugin.',
          selectWidget: 'Select a widget from the sidebar to inspect.',
          customPosition: 'Position:',
          notifications: 'Notifications',
          clear: 'Clear',
          fullscreen: 'Fullscreen mode (Esc)',
          activated: 'Activated',
          deactivated: 'Deactivated',
          unknown: 'Unknown',
          menu: 'Menu',
          exitFullscreen: 'Exit Fullscreen (Esc)',
          themeLight: 'Light theme',
          themeDark: 'Dark theme',
          noWidgets: 'No widgets registered yet',
          inspectorLogs: 'Inspector & Logs',
          notificationsLog: 'Notifications Log',
          apiCallHistory: 'API Call History',
          noNotifications: 'No notifications yet',
          noApiCalls: 'No API calls logged yet',
        },
      },
    },
  })
  app.use(i18n)

  // Настройка роутера с мок-роутами для страниц плагина
  const routes = [
    { path: '/', name: 'root', component: { template: '<div />' } },
  ]

  if (plugin.pages) {
    for (const pathKey of Object.keys(plugin.pages)) {
      const routeName = pathKey === 'index' ? `plugin-${plugin.id}-index` : `plugin-${plugin.id}-${pathKey}`
      routes.push({
        path: pathKey === 'index' ? `/plugin/${plugin.id}` : `/plugin/${plugin.id}/${pathKey}`,
        name: routeName,
        component: { template: '<div />' },
      })
    }
  }

  // Резервный роут
  routes.push({
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: { template: '<div />' },
  })

  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  })

  app.use(router)

  return app
}
