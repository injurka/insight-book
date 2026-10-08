import { usePreferredDark, useStorage } from '@vueuse/core'
import { useHead } from '@vueuse/head'
import { watchEffect } from 'vue'
import { isMobileApp } from '~/01.shared/lib/env'
import { syncSystemBarsTheme } from '~/01.shared/services/system-bars.service'

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

export const themePreference = useStorage<ThemesVariant>('app-theme', ThemesVariant.System)

export function useChangeTheme() {
  const preferredDark = usePreferredDark()

  function getActualTheme(value: ThemesVariant) {
    if (value === ThemesVariant.System)
      return preferredDark.value ? ThemesVariant.Dark : ThemesVariant.Light

    return Object.values(ThemesVariant).includes(value) ? value : ThemesVariant.Light
  }

  useHead({
    meta: [
      {
        name: 'theme-color',
        content: () => themesColors[getActualTheme(themePreference.value)],
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: () => {
          const actualTheme = getActualTheme(themePreference.value)

          return actualTheme === ThemesVariant.Dark || actualTheme === ThemesVariant.Oled
            ? 'black-translucent'
            : 'default'
        },
      },
    ],
  })

  function applyTheme(value: ThemesVariant) {
    const actualTheme = getActualTheme(value)

    if (typeof document === 'undefined')
      return

    document.documentElement.setAttribute('data-theme', actualTheme)

    if (isMobileApp)
      void syncSystemBarsTheme(actualTheme === ThemesVariant.Dark || actualTheme === ThemesVariant.Oled)
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
  }

  return {
    theme: themePreference,
    getHeadThemeColor,
    setTheme,
    toggleTheme,
  }
}
