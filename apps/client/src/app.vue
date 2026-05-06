<script setup lang="ts">
import { useHead } from '@vueuse/head'
import { ReloadPrompt } from '~/components/02.shared/reload-prompt'
import { AddEditWordDialog } from '~/components/05.modules/dictionary'
import { DefaultLayout } from '~/components/06.layouts/default'
import { useChangeTheme } from '~/shared/composables/use-change-theme'

useChangeTheme()

const route = useRoute()
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
</script>

<template>
  <component :is="layouts[layoutName]" v-if="layouts[layoutName]">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </component>

  <router-view v-else v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>

  <ReloadPrompt />
  <AddEditWordDialog />
</template>
