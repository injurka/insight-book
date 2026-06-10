import { useStorage } from '@vueuse/core'
import { useHead } from '@vueuse/head'
import { useUmami } from '~/shared/composables/use-umami'

export enum ThemesVariant {
  Light = 'light',
  Dark = 'dark',
}

const themesColors: Record<ThemesVariant, string> = {
  [ThemesVariant.Light]: '#faf4f2',
  [ThemesVariant.Dark]: '#0d1117',
}

const themePreference = useStorage<ThemesVariant>('app-theme', ThemesVariant.Light)

export function useChangeTheme() {
  const { trackEvent } = useUmami()

  function applyTheme(value: ThemesVariant) {
    document.documentElement.setAttribute('data-theme', value)
    useHead({
      meta: [{ name: 'theme-color', content: themesColors[value] }],
    })
  }

  watchEffect(() => applyTheme(themePreference.value))

  function getHeadThemeColor() {
    return themesColors[themePreference.value]
  }

  const setTheme = (value: ThemesVariant) => {
    themePreference.value = value
  }

  const toggleTheme = () => {
    const newTheme = themePreference.value === ThemesVariant.Light ? ThemesVariant.Dark : ThemesVariant.Light
    setTheme(newTheme)
    trackEvent('theme_changed', { theme: newTheme })
  }

  return {
    theme: themePreference,
    getHeadThemeColor,
    setTheme,
    toggleTheme,
  }
}
