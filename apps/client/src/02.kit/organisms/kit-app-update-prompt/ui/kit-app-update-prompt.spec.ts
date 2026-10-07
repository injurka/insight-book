import type { Pinia } from 'pinia'
import { Icon } from '@iconify/vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import en from '~/01.shared/locales/en.json'
import ru from '~/01.shared/locales/ru.json'
import { useAppUpdateStore } from '~/01.shared/store/app-update.store'
import KitAppUpdatePrompt from './kit-app-update-prompt.vue'

let pinia: Pinia

function createTestI18n(locale: string) {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'ru',
    messages: { ru, en },
  })
}

function mountPrompt(locale = 'ru') {
  return mount(KitAppUpdatePrompt, {
    global: {
      plugins: [pinia, createTestI18n(locale)],
      stubs: {
        Teleport: true,
        Transition: true,
      },
    },
  })
}

function buttonTexts(wrapper: ReturnType<typeof mountPrompt>) {
  return wrapper.findAll('button').map(btn => btn.text())
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

describe('kitAppUpdatePrompt', () => {
  it('renders nothing without an available update', () => {
    const wrapper = mountPrompt()

    expect(wrapper.find('.app-update-prompt').exists()).toBe(false)
  })

  it('localizes the available state', () => {
    const store = useAppUpdateStore()
    store.hasUpdate = true
    store.latestVersion = '1.2.3'

    const wrapper = mountPrompt()

    expect(wrapper.find('.prompt-title').text()).toBe('Доступно обновление v1.2.3')
    expect(wrapper.find('.prompt-description').text())
      .toBe('Доступна новая версия v1.2.3. Скачать и установить прямо сейчас?')
    expect(buttonTexts(wrapper)).toEqual(['Скачать', 'Позже'])
  })

  it('localizes the downloading state and shows progress', () => {
    const store = useAppUpdateStore()
    store.hasUpdate = true
    store.latestVersion = '1.2.3'
    store.isDownloading = true
    store.downloadProgress = 42

    const wrapper = mountPrompt()

    expect(wrapper.find('.prompt-title').text()).toBe('Загрузка обновления v1.2.3')
    expect(wrapper.find('.prompt-description').text()).toBe('Скачивание файла новой версии...')
    expect(wrapper.find('.update-progress-percentage').text()).toBe('42%')
    expect(buttonTexts(wrapper)).toEqual(['Скрыть'])
  })

  it('localizes the ready state', () => {
    const store = useAppUpdateStore()
    store.hasUpdate = true
    store.latestVersion = '1.2.3'
    store.downloadedFilePath = '/storage/insight-book-v1.2.3.apk'
    store.downloadProgress = 100

    const wrapper = mountPrompt()

    expect(wrapper.find('.prompt-title').text()).toBe('Обновление готово к установке')
    expect(wrapper.find('.prompt-description').text()).toBe('Файл обновления v1.2.3 успешно загружен.')
    expect(buttonTexts(wrapper)).toEqual(['Установить', 'Закрыть'])
    expect(wrapper.findComponent(Icon).props('icon')).toBe('mdi:check-circle-outline')
  })

  it('localizes the error state and interpolates the error message', () => {
    const store = useAppUpdateStore()
    store.hasUpdate = true
    store.latestVersion = '1.2.3'
    store.downloadError = 'Network unreachable'

    const wrapper = mountPrompt()

    expect(wrapper.find('.prompt-title').text()).toBe('Ошибка загрузки v1.2.3')
    expect(wrapper.find('.prompt-description').text())
      .toBe('Network unreachable. Вы можете повторить попытку или перейти к релизу.')
    expect(buttonTexts(wrapper)).toEqual(['Повторить', 'В браузере', 'Закрыть'])
    expect(wrapper.findComponent(Icon).props('icon')).toBe('mdi:alert-circle-outline')
  })

  it('renders the prompt in the active locale', () => {
    const store = useAppUpdateStore()
    store.hasUpdate = true
    store.latestVersion = '1.2.3'

    const wrapper = mountPrompt('en')

    expect(wrapper.find('.prompt-title').text()).toBe('Update available v1.2.3')
    expect(buttonTexts(wrapper)).toEqual(['Download', 'Later'])
  })

  it('keeps the status icon in the same row as the title', () => {
    const store = useAppUpdateStore()
    store.hasUpdate = true
    store.latestVersion = '1.2.3'

    const wrapper = mountPrompt()
    const header = wrapper.find('.prompt-header')

    expect(header.exists()).toBe(true)
    expect(header.find('.prompt-icon').exists()).toBe(true)
    expect(header.find('.prompt-title').exists()).toBe(true)
    // Иконка не должна быть отдельной строкой промпта (регрессия мобильной вёрстки)
    expect(wrapper.find('.app-update-prompt > .prompt-icon').exists()).toBe(false)
    expect(wrapper.findComponent(Icon).props('icon')).toBe('solar:download-square-bold')
  })
})
