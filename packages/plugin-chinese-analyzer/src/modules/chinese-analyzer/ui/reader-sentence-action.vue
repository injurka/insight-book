<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitAnalysisDialogAction } from '~/02.kit/organisms/kit-dialog/ui'

interface Props {
  sentence: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ open: [] }>()

const { t } = useI18n()
const ChineseAnalyzerView = defineAsyncComponent(() => import('./chinese-analyzer-view.vue'))
</script>

<template>
  <KitAnalysisDialogAction
    :title="t('plugins.chinese-analyzer.pageTitle')"
    :loading-title="t('plugins.chinese-analyzer.loadingTitle')"
    :loading-description="t('plugins.chinese-analyzer.loadingDescription')"
    icon="mdi:translate"
    @open="emit('open')"
  >
    <ChineseAnalyzerView :initial-sentence="props.sentence" />
  </KitAnalysisDialogAction>
</template>
