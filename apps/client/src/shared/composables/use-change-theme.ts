import { useStorage } from '@vueuse/core'
import { useHead } from '@vueuse/head'
import { useUmami } from '~/shared/composables/use-umami'

export enum ThemesVariant {
  Light = 'light',
  Dark = 'dark',
  Sepia = 'sepia',
  Green = 'green',
  Oled = 'oled',
}

const themesColors: Record<ThemesVariant, string> = {
  [ThemesVariant.Light]: '#faf4f2',
  [ThemesVariant.Dark]: '#0d1117',
  [ThemesVariant.Sepia]: '#f4ecd8',
  [ThemesVariant.Green]: '#e8f3e8',
  [ThemesVariant.Oled]: '#000000',
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
    const themeOrder = [
      ThemesVariant.Light,
      ThemesVariant.Sepia,
      ThemesVariant.Green,
      ThemesVariant.Dark,
      ThemesVariant.Oled,
    ]
    const currentIndex = themeOrder.indexOf(themePreference.value)
    const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length]
    setTheme(nextTheme)
    trackEvent('theme_changed', { theme: nextTheme })
  }

  return {
    theme: themePreference,
    getHeadThemeColor,
    setTheme,
    toggleTheme,
  }
}
