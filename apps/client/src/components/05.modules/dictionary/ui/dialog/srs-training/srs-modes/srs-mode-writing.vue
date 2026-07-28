<script setup lang="ts">
import type { UserDictItem } from '~/shared/types/models'

interface Props {
  card: UserDictItem
}

const props = defineProps<Props>()

const emit = defineEmits<{
  flip: []
}>()

const HanziBoard = lazyComponent(() => import('../../../hanzi-board.vue'))
</script>

<template>
  <div class="writing-mode">
    <p class="writing-hint">
      {{ $t('dictionary.writeHanzi') }}
    </p>
    <div class="translation-hint" v-html="props.card.translation" />
    <HanziBoard
      :text="props.card.word"
      mode="quiz"
      :size="280"
      @complete="emit('flip')"
    />
  </div>
</template>

<style lang="scss" scoped>
.writing-mode {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  .writing-hint {
    color: var(--fg-secondary-color);
    margin: 0;
  }

  .translation-hint {
    font-size: 1.15rem;
    font-weight: 500;
    color: var(--fg-primary-color);
  }
}
</style>
