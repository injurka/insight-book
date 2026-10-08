import type { UploadedFontMeta } from '../types/models/custom-fonts'
import { useLocalStorage } from '@vueuse/core'
import localforage from 'localforage'
import { onMounted, ref } from 'vue'
import { useToast } from '~/01.shared/composables/use-toast'

interface LocalFontData {
  family: string
}

interface WindowWithLocalFonts extends Window {
  queryLocalFonts?: () => Promise<LocalFontData[]>
}

export type { UploadedFontMeta } from '../types/models/custom-fonts'

const FONTS_STORE_KEY_PREFIX = 'user_font_'
const registeredFonts = new Map<string, FontFace>()
const fontRevisions = new Map<string, number>()
const pendingRestores = new Map<string, Promise<void>>()

function registerFont(family: string, font: FontFace) {
  const previous = registeredFonts.get(family)

  if (previous)
    document.fonts.delete(previous)

  document.fonts.add(font)
  registeredFonts.set(family, font)
}

async function restoreFont(family: string) {
  const revision = fontRevisions.get(family)
  const buffer = await localforage.getItem<ArrayBuffer>(`${FONTS_STORE_KEY_PREFIX}${family}`)

  if (!buffer)
    return

  const font = new FontFace(family, buffer)
  await font.load()

  if (fontRevisions.get(family) === revision)
    registerFont(family, font)
}

export function useCustomFonts() {
  const toast = useToast()

  const scannedSystemFonts = useLocalStorage<string[]>('global-scanned-system-fonts', [])
  const uploadedFonts = useLocalStorage<UploadedFontMeta[]>('global-uploaded-fonts-meta', [])
  const isScanning = ref(false)
  const isUploading = ref(false)

  // 1. Инициализация и регистрация сохраненных шрифтов при старте
  async function loadSavedFonts() {
    if (typeof window === 'undefined' || typeof FontFace === 'undefined' || !document.fonts)
      return

    await Promise.all(uploadedFonts.value.map(async ({ family }) => {
      if (registeredFonts.has(family))
        return

      let pending = pendingRestores.get(family)

      if (!pending) {
        pending = restoreFont(family).finally(() => pendingRestores.delete(family))
        pendingRestores.set(family, pending)
      }

      try {
        await pending
      }
      catch (error) {
        console.warn(`Failed to restore font ${family}`, error)
      }
    }))
  }

  onMounted(() => {
    void loadSavedFonts()
  })

  // 2. Сканирование шрифтов системы через window.queryLocalFonts
  async function scanSystemFonts(): Promise<string[]> {
    if (typeof window === 'undefined' || isScanning.value)
      return []

    isScanning.value = true

    try {
      const queryLocalFonts = (window as WindowWithLocalFonts).queryLocalFonts

      if (queryLocalFonts) {
        const fontData = await queryLocalFonts.call(window)
        const rawFamilies = fontData.map(font => font.family)
        const families: string[] = Array.from(new Set<string>(rawFamilies)).sort()

        scannedSystemFonts.value = families
        toast.success(`Найдено ${families.length} системных шрифтов!`)

        return families
      }

      toast.error('Доступ к локальным шрифтам не поддерживается вашим браузером')
    }
    catch (e) {
      console.warn('System font access error', e)
      toast.error('Не удалось получить доступ к системным шрифтам')
    }
    finally {
      isScanning.value = false
    }

    return []
  }

  // 3. Загрузка пользовательского файла шрифта (.ttf, .otf, .woff, .woff2)
  async function uploadFontFile(file: File): Promise<string | null> {
    if (!file || isUploading.value)
      return null

    isUploading.value = true

    try {
      const extension = file.name.split('.').pop()?.toLowerCase()

      if (!['ttf', 'otf', 'woff', 'woff2'].includes(extension || '')) {
        toast.error('Поддерживаются только форматы .ttf, .otf, .woff, .woff2')

        return null
      }

      // Название семейства берем из имени файла без расширения
      const familyName = file.name.replace(/\.[^/.]+$/, '').trim()

      if (!familyName) {
        toast.error('Невалидное имя файла шрифта')

        return null
      }

      const buffer = await file.arrayBuffer()
      const fontFace = new FontFace(familyName, buffer)
      await fontFace.load()

      // Сохраняем файл бинарно в IndexedDB
      await localforage.setItem(`${FONTS_STORE_KEY_PREFIX}${familyName}`, buffer)
      fontRevisions.set(familyName, (fontRevisions.get(familyName) ?? 0) + 1)
      registerFont(familyName, fontFace)

      // Сохраняем мета-информацию
      const meta: UploadedFontMeta = {
        name: familyName,
        family: familyName,
        fileName: file.name,
        size: file.size,
      }

      const existingIndex = uploadedFonts.value.findIndex(f => f.family === familyName)

      if (existingIndex >= 0)
        uploadedFonts.value[existingIndex] = meta
      else
        uploadedFonts.value.push(meta)

      toast.success(`Шрифт "${familyName}" успешно загружен!`)

      return familyName
    }
    catch (e) {
      console.error('Error loading font file', e)
      toast.error('Не удалось прочитать или применить файл шрифта')

      return null
    }
    finally {
      isUploading.value = false
    }
  }

  // 4. Удаление загруженного шрифта
  async function removeUploadedFont(familyName: string) {
    try {
      fontRevisions.set(familyName, (fontRevisions.get(familyName) ?? 0) + 1)
      await localforage.removeItem(`${FONTS_STORE_KEY_PREFIX}${familyName}`)
      const font = registeredFonts.get(familyName)

      if (font) {
        document.fonts.delete(font)
        registeredFonts.delete(familyName)
      }

      uploadedFonts.value = uploadedFonts.value.filter(f => f.family !== familyName)
      toast.success(`Шрифт "${familyName}" удален`)
    }
    catch (e) {
      console.error('Error removing font', e)
      toast.error('Ошибка при удалении шрифта')
    }
  }

  return {
    scannedSystemFonts,
    uploadedFonts,
    isScanning,
    isUploading,
    scanSystemFonts,
    uploadFontFile,
    removeUploadedFont,
    loadSavedFonts,
  }
}
