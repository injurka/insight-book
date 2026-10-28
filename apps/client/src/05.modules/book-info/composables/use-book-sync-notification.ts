import type { SyncNotificationProgress, SyncNotificationSelection, SyncProgressNotificationOptions } from '~/05.modules/library'
import { useI18n } from 'vue-i18n'
import { formatNumber } from '../lib/formatters'

export function useBookSyncNotification() {
  const { t } = useI18n()

  function formatProgress(progress: SyncNotificationProgress, selection: SyncNotificationSelection): string {
    const phase = t(`bookInfo.syncNotificationPhases.${progress.phase}`)
    const currentPage = t('bookInfo.syncNotificationCurrentPage', {
      current: formatNumber(progress.currentPage),
      total: formatNumber(progress.pagesTotal),
    })
    const lines = [
      progress.currentPage > 0 ? `${phase} · ${currentPage}` : phase,
      t('bookInfo.syncNotificationProgress', {
        done: formatNumber(progress.pagesDone),
        total: formatNumber(progress.pagesTotal),
      }),
    ]
    const sections = [
      { enabled: selection.analyzeSentences, key: 'sentences', done: progress.sentencesDone, cached: progress.sentencesFromCache },
      { enabled: selection.analyzeWords, key: 'words', done: progress.wordsDone, cached: progress.wordsFromCache },
      { enabled: selection.ttsSentences || selection.ttsWords, key: 'audio', done: progress.ttsDone, cached: progress.ttsFromCache },
    ]

    for (const section of sections) {
      if (section.enabled) {
        lines.push(t(`bookInfo.syncNotificationCounts.${section.key}`, {
          done: formatNumber(section.done),
          cached: formatNumber(section.cached),
        }))
      }
    }

    return lines.join('\n')
  }

  function createNotificationOptions(title: string | undefined, selection: SyncNotificationSelection): SyncProgressNotificationOptions {
    const selected = { ...selection }

    return {
      title: title || t('bookInfo.syncNotificationTitle'),
      formatProgress: progress => formatProgress(progress, selected),
    }
  }

  return { createNotificationOptions }
}
