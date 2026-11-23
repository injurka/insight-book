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
const RussianAnalyzerView = defineAsyncComponent(() => import('./russian-analyzer-view.vue'))
</script>

<template>
  <KitAnalysisDialogAction
    :title="t('plugins.russian-analyzer.pageTitle')"
    :loading-label="t('plugins.russian-analyzer.analyzingBtn')"
    icon="mdi:alphabet-cyrillic"
    @open="emit('open')"
  >
    <RussianAnalyzerView :initial-sentence="props.sentence" />
  </KitAnalysisDialogAction>
</template>
