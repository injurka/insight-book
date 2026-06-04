import { ref } from 'vue'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { useAuthStore } from '~/shared/store/auth.store'

export function useBookCover() {
  const libraryStore = useLibraryStore()
  const authStore = useAuthStore()

  const coverInputRef = ref<HTMLInputElement | null>(null)

  function triggerCoverInput() {
    if (!authStore.user)
      return
    coverInputRef.value?.click()
  }

  function onCoverChange(e: Event) {
    const target = e.target as HTMLInputElement
    if (target.files && target.files.length > 0 && libraryStore.currentBookInfo) {
      libraryStore.updateBookCover(libraryStore.currentBookInfo.id, target.files[0])
    }
  }

  return {
    coverInputRef,
    triggerCoverInput,
    onCoverChange,
  }
}
