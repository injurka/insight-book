<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog } from '~/components/01.kit'
import { useDictionaryStore } from '../../store/dictionary.store'

const visible = defineModel<boolean>('visible', { required: true })

const store = useDictionaryStore()
const { t } = useI18n()

function moveToDeck(deckId: number | null) {
  store.bulkMoveToDeck(deckId)
  visible.value = false
}
</script>

<template>
  <KitDialog v-model:visible="visible" :title="t('dictionary.moveToDeck')" :max-width="400">
    <div class="bulk-move-content">
      <KitBtn variant="outlined" class="deck-btn" @click="moveToDeck(null)">
        {{ t('dictionary.noDeckGeneral') }}
      </KitBtn>
      <KitBtn
        v-for="deck in store.decks"
        :key="deck.id"
        variant="tonal"
        class="deck-btn"
        @click="moveToDeck(deck.id)"
      >
        <Icon icon="mdi:folder-outline" class="mr-2" />
        {{ deck.name }}
      </KitBtn>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.bulk-move-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.deck-btn {
  width: 100%;
  justify-content: flex-start;
}

.mr-2 {
  margin-right: 8px;
}
</style>
