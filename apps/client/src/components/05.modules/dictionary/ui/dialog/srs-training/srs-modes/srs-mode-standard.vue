<script setup lang="ts">
import type { UserDictItem } from '~/shared/types/models'

const props = defineProps<{
  card: UserDictItem
}>()
</script>

<template>
  <div class="standard-mode">
    <div class="word-huge">
      {{ props.card.word }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.standard-mode {
  width: 100%;
  text-align: center;
}

.word-huge {
  font-size: 3rem;
  font-weight: bold;
  color: var(--fg-primary-color);
}
</style>
