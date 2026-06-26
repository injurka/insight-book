<script setup lang="ts">
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import { ReloadPrompt } from '~/components/02.shared/reload-prompt'
import { DefaultLayout } from '~/components/06.layouts/default'
import { useChangeTheme } from '~/shared/composables/use-change-theme'
import { useGlobalTracking } from '~/shared/composables/use-global-tracking'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

const AddEditWordDialog = lazyComponent(() => import('~/components/05.modules/dictionary/ui/dialog/add-edit-word-dialog.vue'))

useChangeTheme()

const route = useRoute()
const analysisStore = useAnalysisStore()
const settingsStore = useGlobalSettingsStore()
const { locale, t } = useI18n()

useGlobalTracking()

watch(() => settingsStore.appLanguage, (newLang) => {
  locale.value = newLang
}, { immediate: true })

const layoutName = computed(() => (route.meta.layout as string) || 'default')

const layouts: Record<string, Component> = {
  default: DefaultLayout,
}

const siteUrl = 'https://insight-book.trip-scheduler.ru'
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

useHead({
  titleTemplate: titleChunk => titleChunk ? `${titleChunk} | ${siteName}` : siteName,
  htmlAttrs: {
    lang: computed(() => locale.value),
  },
  meta: [
    { name: 'description', content: description },
  ],
  link: [
    {
      rel: 'canonical',
      href: computed(() => `${siteUrl}${route.path}`),
    },
    {
      rel: 'icon',
      type: 'image/svg+xml',
      href: '/logo.svg',
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
      <transition name="fade" mode="out-in">
        <component :is="Component" :key="currentRoute.path" />
      </transition>
    </router-view>
  </component>

  <router-view v-else v-slot="{ Component, route: currentRoute }">
    <transition name="fade" mode="out-in">
      <component :is="Component" :key="currentRoute.path" />
    </transition>
  </router-view>

  <ReloadPrompt />
  <AddEditWordDialog />
</template>
