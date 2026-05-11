<script setup lang="ts">
import { useHead } from '@vueuse/head'
import { ReloadPrompt } from '~/components/02.shared/reload-prompt'
import { DefaultLayout } from '~/components/06.layouts/default'
import { useChangeTheme } from '~/shared/composables/use-change-theme'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { AddEditWordDialog } from './components/05.modules/dictionary'

useChangeTheme()

const route = useRoute()
const analysisStore = useAnalysisStore()

const layoutName = computed(() => (route.meta.layout as string) || 'default')

const layouts: Record<string, Component> = {
  default: DefaultLayout,
}

const siteUrl = 'https://insight-book.trip-scheduler.ru'
const siteName = 'InsightBook'
const description = 'InsightBook'

useHead({
  titleTemplate: titleChunk => titleChunk ? `${titleChunk} | ${siteName}` : siteName,
  htmlAttrs: {
    lang: 'ru',
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
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        'name': siteName,
        'alternateName': ['Блокнот', 'Личные заметки', 'Менеджер заметок'],
        'url': siteUrl,
        'description': description,
        'applicationCategory': 'UtilityApplication',
        'operatingSystem': 'Any',
        'offers': {
          '@type': 'Offer',
          'price': '0',
          'priceCurrency': 'RUB',
        },
      }),
    },
  ],
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
        <component :is="Component" :key="currentRoute.fullPath" />
      </transition>
    </router-view>
  </component>

  <router-view v-else v-slot="{ Component, route: currentRoute }">
    <transition name="fade" mode="out-in">
      <component :is="Component" :key="currentRoute.fullPath" />
    </transition>
  </router-view>

  <ReloadPrompt />
  <AddEditWordDialog />
</template>
