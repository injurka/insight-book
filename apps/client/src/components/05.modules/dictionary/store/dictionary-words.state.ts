import type { UserDictItem } from '~/shared/types/models'
import { shallowRef } from 'vue'

// Shared dictionary words state.
// Kept in a standalone module so that dictionary.store and
// dictionary-filters.store do not import each other (circular dependency).
export const dictionaryWords = shallowRef<UserDictItem[]>([])
