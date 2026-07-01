import { defineSetupVue3 } from '@histoire/plugin-vue'
import { addCollection } from '@iconify/vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { vLongPress } from '~/shared/directives/long-press'
import { vRipple } from '~/shared/directives/ripple'
import { i18n, loadLanguageAsync } from '~/shared/plugins/i18n'

import '~/assets/scss/global.scss'
import '~/assets/scss/normalize.scss'

if (typeof window !== 'undefined') {
  document.documentElement.setAttribute('data-theme', 'light')

  const devPanel = document.createElement('div')
  devPanel.innerHTML = `
    <div style="position: fixed; bottom: 16px; right: 16px; z-index: 9999; background: var(--bg-secondary-color, #fff); padding: 8px; border-radius: 8px; border: 1px solid var(--border-secondary-color, #ccc); display: flex; gap: 8px; font-family: sans-serif; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
      <select id="hist-theme-select" style="padding: 4px; border-radius: 4px; background: var(--bg-primary-color); color: var(--fg-primary-color); border: 1px solid var(--border-primary-color);">
        <option value="light">Лайт</option>
        <option value="dark">Дарк</option>
        <option value="sepia">Сепия</option>
        <option value="green">Зеленая</option>
        <option value="oled">OLED</option>
      </select>
      <select id="hist-lang-select" style="padding: 4px; border-radius: 4px; background: var(--bg-primary-color); color: var(--fg-primary-color); border: 1px solid var(--border-primary-color);">
        <option value="ru">RU</option>
        <option value="en">EN</option>
        <option value="zh">ZH</option>
      </select>
    </div>
  `
  document.body.appendChild(devPanel)

  document.getElementById('hist-theme-select')?.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', (e.target as HTMLSelectElement).value)
  })

  document.getElementById('hist-lang-select')?.addEventListener('change', (e) => {
    const lang = (e.target as HTMLSelectElement).value
    window.dispatchEvent(new CustomEvent('hist-lang-change', { detail: lang }))
  })
}

export const setupVue3 = defineSetupVue3(({ app }) => {
  const pinia = createPinia()

  app.directive('ripple', vRipple)
  app.directive('longPress', vLongPress)

  app.use(pinia)
  app.use(i18n)

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/:catchAll(.*)',
        name: 'CatchAll',
        component: { template: '<div><slot /></div>' },
      },
    ],
  })

  app.use(router)

  if (typeof window !== 'undefined') {
    window.addEventListener('hist-lang-change', (e: any) => {
      loadLanguageAsync(e.detail)
    })
  }
})

import('~/assets/icons-bundle.json').then((module) => {
  addCollection(module.default)
})
