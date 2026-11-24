<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { KitActivityLoader } from '~/02.kit/molecules/kit-activity-loader/ui'

const { t } = useI18n()
</script>

<template>
  <KitActivityLoader
    icon="mdi:book-open-page-variant-outline"
    :title="t('bookDeck.loadingTitle')"
    :description="t('bookDeck.scanning')"
    :hint="t('bookDeck.loadingHint')"
    hint-icon="mdi:bookmark-multiple-outline"
  />
</template>
