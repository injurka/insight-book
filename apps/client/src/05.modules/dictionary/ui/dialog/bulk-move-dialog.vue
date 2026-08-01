<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitCheckbox, KitDialog } from '~/02.kit'
import { useDictionaryStore } from '../../store/dictionary.store'

const visible = defineModel<boolean>('visible', { required: true })

const store = useDictionaryStore()
const { t } = useI18n()

const selectedDecks = ref<Set<number>>(new Set())

watch(visible, (val) => {
  if (val)
    selectedDecks.value.clear()
})

function toggleDeck(id: number) {
  if (selectedDecks.value.has(id))
    selectedDecks.value.delete(id)

  else
    selectedDecks.value.add(id)
}

function save() {
  store.bulkMoveToDecks(Array.from(selectedDecks.value))
  visible.value = false
}
</script>

<template>
  <KitDialog v-model:visible="visible" :title="t('dictionary.moveToDeck')" :max-width="400">
    <div class="bulk-move-content">
      <div
        v-for="deck in store.decks"
        :key="deck.id"
        class="deck-row"
        @click="toggleDeck(deck.id)"
      >
        <KitCheckbox :model-value="selectedDecks.has(deck.id)" />
        <span class="deck-name">{{ deck.name }}</span>
      </div>

      <div class="actions">
        <KitBtn variant="outlined" @click="visible = false">
          {{ t('common.cancel') }}
        </KitBtn>
        <KitBtn variant="solid" @click="save">
          {{ t('common.save') }}
        </KitBtn>
      </div>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.bulk-move-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.deck-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--bg-secondary-color);
  }
}

.deck-name {
  font-size: 1rem;
  color: var(--fg-primary-color);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
</style>
