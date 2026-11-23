<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import KitDialog from './kit-dialog.vue'

interface Props {
  title: string
  loadingLabel: string
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
        <p role="status">
          {{ props.loadingLabel }}
        </p>
      </template>
    </Suspense>
  </KitDialog>
</template>
