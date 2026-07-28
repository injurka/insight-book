<script setup lang="ts">
import type { UserDictItem } from '~/shared/types/models'
import { KitBtn } from '~/components/01.kit'

interface Props {
  card: UserDictItem
  isLoading: boolean
  isPlaying: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  speak: []
  flip: []
}>()
</script>

<template>
  <div class="audio-mode">
    <KitBtn
      :icon="props.isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium'"
      :loading="props.isLoading"
      size="lg"
      color="accent"
      :class="{ 'is-playing-pulse': props.isPlaying }"
      @click="emit('speak')"
    />
    <p>{{ $t('dictionary.listenAndRecall') }}</p>
  </div>
</template>

<style lang="scss" scoped>
.audio-mode {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;

  p {
    color: var(--fg-secondary-color);
    margin: 0;
  }
}

.is-playing-pulse {
  :deep(.kit-btn-icon) {
    animation: pulse-op 1.2s infinite;
    color: var(--fg-error-color) !important;
  }
}
</style>
