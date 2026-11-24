<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { KitActivityLoader } from '~/02.kit/molecules/kit-activity-loader/ui'
import KitDialog from './kit-dialog.vue'

interface Props {
  title: string
  loadingTitle: string
  loadingDescription: string
  icon: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ open: [] }>()

const visible = ref(false)

function openAnalysis() {
  emit('open')
  visible.value = true
}
</script>

<template>
  <button
    type="button"
    class="action-btn"
    :title="props.title"
    :aria-label="props.title"
    aria-haspopup="dialog"
    @click="openAnalysis"
  >
    <Icon :icon="props.icon" />
  </button>

  <KitDialog
    v-model:visible="visible"
    :title="props.title"
    :icon="props.icon"
    fullscreen
    :minimizable="false"
    :resizable="false"
  >
    <Suspense v-if="visible">
      <slot />
      <template #fallback>
        <KitActivityLoader
          :icon="props.icon"
          :title="props.loadingTitle"
          :description="props.loadingDescription"
        />
      </template>
    </Suspense>
  </KitDialog>
</template>
