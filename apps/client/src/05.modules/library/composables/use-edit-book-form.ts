import type { Ref } from 'vue'
import type { Book } from '~/01.shared/types/models'
import { ref, watch } from 'vue'
import { formatToDateTimeLocal, parseFromDateTimeLocal } from '../lib/formatters'

export function useEditBookForm(bookProp: Ref<Book | null>, emit: any) {
  const editCoverInput = ref<HTMLInputElement | null>(null)
  const editingBook = ref<Partial<Book>>({})
  const editingCoverFile = ref<File | null>(null)

  watch(bookProp, (newBook) => {
    if (newBook) {
      editingCoverFile.value = null
      editingBook.value = {
        ...newBook,
        language: newBook.language === 'jp' ? 'ja' : newBook.language,
        createdAt: formatToDateTimeLocal(newBook.createdAt),
        status: newBook.status || 'reading',
        isFavorite: newBook.isFavorite || false,
        isPublic: newBook.isPublic || false,
        textDirection: newBook.textDirection || 'auto',
      }
    }
    else {
      editingBook.value = {}
    }
  }, { immediate: true })

  function onEditCoverChange(e: Event) {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file)
      return

    editingCoverFile.value = file
    const reader = new FileReader()
    reader.onload = (event) => {
      editingBook.value.coverUrl = event.target?.result as string
    }

    reader.readAsDataURL(file)
  }

  function handleSave() {
    if (editingBook.value.id === undefined || editingBook.value.id === null)
      return

    const payload = { ...editingBook.value }

    if (payload.createdAt)
      payload.createdAt = parseFromDateTimeLocal(payload.createdAt)

    // Если направление стоит Авто, передаем null, чтобы сработал дефолтный обработчик LLM
    if (payload.textDirection === 'auto')
      payload.textDirection = null

    payload.currentPage = Number(payload.currentPage) || 1
    emit('save', { bookData: payload, coverFile: editingCoverFile.value })
  }

  function handleDelete() {
    if (editingBook.value.id !== undefined)
      emit('delete', editingBook.value.id)
  }

  return {
    editCoverInput,
    editingBook,
    editingCoverFile,
    onEditCoverChange,
    handleSave,
    handleDelete,
  }
}
