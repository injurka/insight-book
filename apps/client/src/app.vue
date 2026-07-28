<script setup lang="ts">
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import { ReloadPrompt } from '~/components/02.shared/reload-prompt'
import { ToastManager } from '~/components/02.shared/toast-manager'
import { DefaultLayout } from '~/components/06.layouts/default'
import { useBackHandler } from '~/shared/composables/use-back-handler'
import { useChangeTheme } from '~/shared/composables/use-change-theme'
import { useGlobalTracking } from '~/shared/composables/use-global-tracking'
import { isViewTransitionSupported } from '~/shared/lib/view-transitions'
import { loadLanguageAsync } from '~/shared/plugins/i18n'
import { useAnalysisStore } from '~/shared/store/analysis/analysis.store'
import { usePwaStore } from '~/shared/store/pwa.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

const AddEditWordDialog = lazyComponent(() => import('~/components/05.modules/dictionary/ui/dialog/add-edit-word-dialog.vue'))

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

  if ('__TAURI_INTERNALS__' in window) {
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
          if (!wasHandled) {
            router.back()
          }
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
const useViewTransitions = isViewTransitionSupported()

const layouts: Record<string, Component> = {
  default: DefaultLayout,
}

const siteUrl = 'https://insight-book.ru'
const siteName = 'InsightBook'
const description = computed(() => t('app.description'))

const headScripts: any[] = [
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
    if (val && val !== key) {
      return val
    }
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
  script: headScripts,
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
      <component :is="Component" v-if="useViewTransitions" :key="currentRoute.path" />
      <transition v-else name="fade" mode="out-in">
        <component :is="Component" :key="currentRoute.path" />
      </transition>
    </router-view>
  </component>

  <router-view v-else v-slot="{ Component, route: currentRoute }">
    <component :is="Component" v-if="useViewTransitions" :key="currentRoute.path" />
    <transition v-else name="fade" mode="out-in">
      <component :is="Component" :key="currentRoute.path" />
    </transition>
  </router-view>

  <ReloadPrompt />
  <AddEditWordDialog />
  <ToastManager />
</template>
