<script setup lang="ts">
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import { loadLanguageAsync } from '~/00.plugins/i18n'
import { useBackHandler } from '~/01.shared/composables/use-back-handler'
import { useChangeTheme } from '~/01.shared/composables/use-change-theme'
import { useGlobalTracking } from '~/01.shared/composables/use-global-tracking'
import { isTauri } from '~/01.shared/lib/env'
import { isNativeTransitionRoute, isViewTransitionSupported } from '~/01.shared/lib/view-transitions'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { usePwaStore } from '~/01.shared/store/pwa.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitReloadPrompt } from '~/02.kit/organisms/kit-reload-prompt'
import { KitToastManager } from '~/02.kit/organisms/kit-toast-manager'
import { DefaultLayout } from '~/06.layouts/default'

const AddEditWordDialog = lazyComponent(() => import('~/05.modules/dictionary/ui/dialog/add-edit-word-dialog.vue'))

useChangeTheme()
useGlobalTracking()

const route = useRoute()
const analysisStore = useAnalysisStore()
const settingsStore = useGlobalSettingsStore()
const { locale, t } = useI18n()

const router = useRouter()
const { triggerBack } = useBackHandler()

onMounted(async () => {
  const pwaStore = usePwaStore()
  pwaStore.checkPushStatus()

  if (isTauri) {
    try {
      const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link')
      await onOpenUrl((urls) => {
        for (const url of urls) {
          try {
            const parsed = new URL(url)
            const isInsightbook = parsed.protocol === 'insightbook:'
            const isWebCallback = parsed.pathname.includes('/callback')

            if (isInsightbook || isWebCallback) {
              // For mobile: insightbook://auth/callback?code=...  → exchange code for token
              // For web:    https://.../auth/yandex/callback?token=... → use token directly
              router.push({
                path: '/auth/yandex/callback',
                query: Object.fromEntries(parsed.searchParams),
              })
            }
          }
          catch (e) {
            console.error('Invalid deep link URL', e)
          }
        }
      })
    }
    catch (e) {
      console.warn('Failed to attach deep link listener', e)
    }

    if (/android/i.test(navigator.userAgent)) {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        await listen('tauri://go-back', () => {
          const wasHandled = triggerBack()
          if (!wasHandled)
            router.back()
        })
      }
      catch (e) {
        console.warn('Failed to attach Android back button listener', e)
      }
    }
  }
})

watch(() => settingsStore.appLanguage, (newLang) => {
  loadLanguageAsync(newLang)
}, { immediate: true })

const layoutName = computed(() => (route.meta.layout as string) || 'default')
// Native View Transition (морф обложки) — только между библиотекой и страницей
// книги (оба маршрута из TRANSITION_ROUTES); для остальной навигации —
// CSS-переход fade (см. template). Имя предыдущего маршрута нужно, чтобы
// переходы вида «dictionary → home» тоже получили fade, а не мгновенный swap.
const viewTransitionsSupported = isViewTransitionSupported()
const prevRouteName = ref<unknown>(null)

function useNativeTransition(routeName: unknown) {
  return viewTransitionsSupported
    && isNativeTransitionRoute(routeName)
    && isNativeTransitionRoute(prevRouteName.value)
}

const layouts: Record<string, Component> = {
  default: DefaultLayout,
}

const siteUrl = 'https://insight-book.ru'
const siteName = 'InsightBook'
const description = computed(() => t('app.description'))

const headScripts: Record<string, unknown>[] = [
  {
    type: 'application/ld+json',
    children: computed(() => JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': siteName,
      'alternateName': [t('app.alternateName1'), t('app.alternateName2'), t('app.alternateName3')],
      'url': siteUrl,
      'description': description.value,
      'applicationCategory': 'UtilityApplication',
      'operatingSystem': 'Any',
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'RUB',
      },
    })),
  },
]

const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID
const umamiUrl = import.meta.env.VITE_UMAMI_URL
const isDev = import.meta.env.DEV

if (!isDev && umamiWebsiteId && umamiUrl) {
  headScripts.push({
    'async': true,
    'defer': true,
    'data-website-id': umamiWebsiteId,
    'src': umamiUrl,
    'data-performance': 'true',
  })
}

const titleChunk = computed(() => {
  if (route.name) {
    const key = `routes.${String(route.name)}`
    const val = t(key)
    if (val && val !== key)
      return val
  }

  return ''
})

useHead({
  title: titleChunk,
  titleTemplate: titleChunk => titleChunk ? `${titleChunk} | ${siteName}` : siteName,
  htmlAttrs: {
    lang: computed(() => locale.value),
  },
  meta: [
    { name: 'description', content: description },
    // Open Graph
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: computed(() => titleChunk.value ? `${titleChunk.value} | ${siteName}` : siteName) },
    { property: 'og:description', content: description },
    { property: 'og:url', content: computed(() => `${siteUrl}${route.path}`) },
    { property: 'og:site_name', content: siteName },
    { property: 'og:image', content: `${siteUrl}/logo.png` },
    // Twitter Card
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: computed(() => titleChunk.value ? `${titleChunk.value} | ${siteName}` : siteName) },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: `${siteUrl}/logo.png` },
    // Additional SEO Tags
    { name: 'robots', content: 'index, follow' },
  ],
  link: [
    {
      rel: 'canonical',
      href: computed(() => `${siteUrl}${route.path}`),
    },
  ],
  script: headScripts as never[],
})

watch(() => route.name, (_name, oldName) => {
  prevRouteName.value = oldName
})

watch(() => route.path, () => {
  analysisStore.closePopover()
  analysisStore.closeSelectionTooltip()
  analysisStore.sidebarOpen = false
  analysisStore.cancelPageAnalysis()
  analysisStore.addEditWordModalOpen = false
})
</script>

<template>
  <component :is="layouts[layoutName]" v-if="layouts[layoutName]">
    <router-view v-slot="{ Component, route: currentRoute }">
      <!-- Native-маршруты рендерим без <transition>: старая и новая страницы
           не должны перекрываться в DOM, иначе view-transition-name обложки
           дублируется, и браузер абортит переход (InvalidStateError) -->
      <component :is="Component" v-if="useNativeTransition(currentRoute.name)" :key="currentRoute.path" />
      <!-- appear — чтобы fade срабатывал и при первом монтировании этой ветки
           (переход с native-маршрута на обычный) -->
      <transition
        v-else
        name="fade"
        mode="out-in"
        appear
      >
        <component :is="Component" :key="currentRoute.path" />
      </transition>
    </router-view>
  </component>

  <router-view v-else v-slot="{ Component, route: currentRoute }">
    <component :is="Component" v-if="useNativeTransition(currentRoute.name)" :key="currentRoute.path" />
    <transition
      v-else
      name="fade"
      mode="out-in"
      appear
    >
      <component :is="Component" :key="currentRoute.path" />
    </transition>
  </router-view>

  <KitReloadPrompt />
  <AddEditWordDialog />
  <KitToastManager />
</template>
