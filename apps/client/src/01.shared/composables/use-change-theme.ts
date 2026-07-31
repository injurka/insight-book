import { usePreferredDark, useStorage } from '@vueuse/core'
import { useHead } from '@vueuse/head'
import { watchEffect } from 'vue'
import { useUmami } from '~/01.shared/composables/use-umami'

export enum ThemesVariant {
  System = 'system',
  Light = 'light',
  Dark = 'dark',
  Sepia = 'sepia',
  Green = 'green',
  Oled = 'oled',
}

const themesColors: Record<ThemesVariant, string> = {
  [ThemesVariant.System]: '', // Evaluated dynamically
  [ThemesVariant.Light]: '#faf4f2',
  [ThemesVariant.Dark]: '#0d1117',
  [ThemesVariant.Sepia]: '#f4ecd8',
  [ThemesVariant.Green]: '#e8f3e8',
  [ThemesVariant.Oled]: '#000000',
}

const themePreference = useStorage<ThemesVariant>('app-theme', ThemesVariant.System)

export function useChangeTheme() {
  const { trackEvent } = useUmami()
  const preferredDark = usePreferredDark()

  function getActualTheme(value: ThemesVariant) {
    if (value === ThemesVariant.System) {
      return preferredDark.value ? ThemesVariant.Dark : ThemesVariant.Light
    }
    return value
  }

  useHead({
    meta: [
      {
        name: 'theme-color',
        content: () => themesColors[getActualTheme(themePreference.value)],
      },
    ],
  })

  function applyTheme(value: ThemesVariant) {
    const actualTheme = getActualTheme(value)
    document.documentElement.setAttribute('data-theme', actualTheme)
  }

  watchEffect(() => applyTheme(themePreference.value))

  function getHeadThemeColor() {
    return themesColors[getActualTheme(themePreference.value)]
  }

  const setTheme = (value: ThemesVariant) => {
    themePreference.value = value
  }

  const toggleTheme = () => {
    const themeOrder = [
      ThemesVariant.System,
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
