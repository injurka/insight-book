import { useLocalStorage } from '@vueuse/core'
import localforage from 'localforage'
import { onMounted, ref } from 'vue'
import { useToast } from '~/01.shared/composables/use-toast'

export interface UploadedFontMeta {
  name: string
  family: string
  fileName: string
  size: number
}

const FONTS_STORE_KEY_PREFIX = 'user_font_'
let isFontsLoaded = false

export function useCustomFonts() {
  const toast = useToast()

  const scannedSystemFonts = useLocalStorage<string[]>('global-scanned-system-fonts', [])
  const uploadedFonts = useLocalStorage<UploadedFontMeta[]>('global-uploaded-fonts-meta', [])
  const isScanning = ref(false)
  const isUploading = ref(false)

  // 1. Инициализация и регистрация сохраненных шрифтов при старте
  async function loadSavedFonts() {
    if (typeof window === 'undefined' || isFontsLoaded)
      return

    isFontsLoaded = true
    for (const fontMeta of uploadedFonts.value) {
      try {
        const buffer = await localforage.getItem<ArrayBuffer>(`${FONTS_STORE_KEY_PREFIX}${fontMeta.family}`)
        if (buffer) {
          const fontFace = new FontFace(fontMeta.family, buffer)
          await fontFace.load()
          document.fonts.add(fontFace)
        }
      }
      catch (e) {
        console.warn(`Failed to restore font ${fontMeta.family}`, e)
      }
    }
  }

  onMounted(() => {
    loadSavedFonts()
  })

  // 2. Сканирование шрифтов системы через window.queryLocalFonts
  async function scanSystemFonts(): Promise<string[]> {
    if (typeof window === 'undefined')
      return []

    isScanning.value = true
    try {
      if ('queryLocalFonts' in window) {
        // eslint-disable-next-line ts/no-explicit-any
        const fontData = await (window as any).queryLocalFonts()
        // eslint-disable-next-line ts/no-explicit-any
        const rawFamilies: string[] = fontData.map((f: any) => String(f.family))
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
    if (!file)
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
      document.fonts.add(fontFace)

      // Сохраняем файл бинарно в IndexedDB
      await localforage.setItem(`${FONTS_STORE_KEY_PREFIX}${familyName}`, buffer)

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
      await localforage.removeItem(`${FONTS_STORE_KEY_PREFIX}${familyName}`)
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
