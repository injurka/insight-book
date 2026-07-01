<script setup lang="ts">
import type { UserDictItem } from '~/shared/types/models'
import { KitBtn } from '~/components/01.kit'

const props = defineProps<{
  card: UserDictItem
  isLoading: boolean
  isPlaying: boolean
}>()

const emit = defineEmits<{
  speak: []
  flip: []
}>()
</script>

<template>
  <div class="audio-mode">
    <KitBtn
      :icon="props.isLoading ? 'mdi:loading' : (props.isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
      size="lg"
      color="accent"
      :class="{ 'spin-animation': props.isLoading, 'pulse-animation': props.isPlaying }"
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
</style>
