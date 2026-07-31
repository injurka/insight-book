import type { UserDictItem } from '~/01.shared/types/models'
import { useI18n } from 'vue-i18n'
import { useToast } from '~/01.shared/composables/use-toast'
import { useUmami } from '~/01.shared/composables/use-umami'

export function useAnkiExport() {
  const toast = useToast()
  const { trackEvent } = useUmami()
  const { t } = useI18n()

  function exportToAnki(wordsToExport: UserDictItem[]) {
    if (!wordsToExport.length)
      return

    const rows = wordsToExport.map((w) => {
      const translation = (w.translation || '').replace(/\n/g, '<br>')
      const notes = (w.notes || '').replace(/\n/g, '<br>')
      return `${w.word}\t${w.transcription || ''}\t${translation}\t${notes}`
    })

    const content = rows.join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `insight_anki_export_${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)

    toast.success(t('dictionary.ankiExported'))
    trackEvent('anki_export_downloaded')
  }

  return { exportToAnki }
}
