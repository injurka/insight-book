import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '~/05.modules/library/store/library.store'

export interface SyncSection {
  key: string
  icon: string
  label: string
  done: number
  total: number
  estimatedTotal?: number
  fromCache: number
  percent: number
  status: 'pending' | 'active' | 'done'
  fillClass: string
}

interface SectionParams {
  key: string
  icon: string
  label: string
  done: number
  total: number
  fromCache: number
  fillClass: string
  pagePercent: number
  pagesTotal: number
  pagesDone: number
  isFinished: boolean
  estimatedTotal?: number
}

function computeSectionPercent(
  isFinished: boolean,
  isPages: boolean,
  done: number,
  total: number,
  pagePercent: number,
): number {
  if (isFinished)
    return 100
  if (isPages)
    return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0

  return pagePercent
}

function computeSectionStatus(
  isFinished: boolean,
  isPages: boolean,
  pagesTotal: number,
  pagesDone: number,
): SyncSection['status'] {
  if (isFinished)
    return 'done'
  const isPending = isPages ? pagesTotal === 0 : pagesDone === 0

  return isPending ? 'pending' : 'active'
}

function createSyncSection(params: SectionParams): SyncSection {
  const isPages = params.key === 'pages'

  const percent = computeSectionPercent(
    params.isFinished,
    isPages,
    params.done,
    params.total,
    params.pagePercent,
  )

  const status = computeSectionStatus(
    params.isFinished,
    isPages,
    params.pagesTotal,
    params.pagesDone,
  )

  return {
    key: params.key,
    icon: params.icon,
    label: params.label,
    done: params.done,
    total: params.total,
    estimatedTotal: params.estimatedTotal,
    fromCache: params.fromCache,
    percent,
    status,
    fillClass: params.fillClass,
  }
}

type SyncProgressData = ReturnType<typeof useLibraryStore>['syncProgress']
type SyncOptionsData = ReturnType<typeof useLibraryStore>['syncOptions']
type BookInfoData = ReturnType<typeof useLibraryStore>['currentBookInfo']

function appendPagesSection(
  list: SyncSection[],
  opts: SyncOptionsData,
  p: SyncProgressData,
  finished: boolean,
  pagePercent: number,
  label: string,
): void {
  if (!opts.cachePages)
    return

  list.push(createSyncSection({
    key: 'pages',
    icon: 'mdi:file-document-multiple-outline',
    label,
    done: p.pagesDone,
    total: p.pagesTotal,
    fromCache: 0,
    fillClass: 'pages-fill',
    pagePercent,
    pagesTotal: p.pagesTotal,
    pagesDone: p.pagesDone,
    isFinished: finished,
  }))
}

function appendSentencesSection(
  list: SyncSection[],
  opts: SyncOptionsData,
  p: SyncProgressData,
  finished: boolean,
  pagePercent: number,
  label: string,
  book: BookInfoData,
): void {
  if (!opts.analyzeSentences)
    return

  list.push(createSyncSection({
    key: 'sentences',
    icon: 'mdi:brain',
    label,
    done: p.sentencesDone,
    total: p.sentencesTotal,
    fromCache: p.sentencesFromCache,
    fillClass: 'sentences-fill',
    pagePercent,
    pagesTotal: p.pagesTotal,
    pagesDone: p.pagesDone,
    isFinished: finished,
    estimatedTotal: book?.stats?.totalSentences || undefined,
  }))
}

function appendWordsSection(
  list: SyncSection[],
  opts: SyncOptionsData,
  p: SyncProgressData,
  finished: boolean,
  pagePercent: number,
  label: string,
  book: BookInfoData,
): void {
  if (!opts.analyzeWords)
    return

  list.push(createSyncSection({
    key: 'words',
    icon: 'mdi:format-text',
    label,
    done: p.wordsDone,
    total: p.wordsTotal,
    fromCache: p.wordsFromCache,
    fillClass: 'words-fill',
    pagePercent,
    pagesTotal: p.pagesTotal,
    pagesDone: p.pagesDone,
    isFinished: finished,
    estimatedTotal: book?.stats?.totalWords || undefined,
  }))
}

function computeEstimatedTts(opts: SyncOptionsData, book: BookInfoData): number | undefined {
  const stats = book?.stats
  if (!stats)
    return undefined

  let total = 0
  if (opts.ttsSentences && stats.totalSentences)
    total += stats.totalSentences
  if (opts.ttsWords && stats.totalWords)
    total += stats.totalWords

  return total > 0 ? total : undefined
}

function appendTtsSection(
  list: SyncSection[],
  opts: SyncOptionsData,
  p: SyncProgressData,
  finished: boolean,
  pagePercent: number,
  label: string,
  book: BookInfoData,
): void {
  if (!opts.ttsSentences && !opts.ttsWords)
    return

  list.push(createSyncSection({
    key: 'tts',
    icon: 'mdi:headphones',
    label,
    done: p.ttsDone,
    total: p.ttsTotal,
    fromCache: p.ttsFromCache,
    fillClass: 'tts-fill',
    pagePercent,
    pagesTotal: p.pagesTotal,
    pagesDone: p.pagesDone,
    isFinished: finished,
    estimatedTotal: computeEstimatedTts(opts, book),
  }))
}

export function useBookSyncSections(isFinished: ComputedRef<boolean>) {
  const libraryStore = useLibraryStore()
  const { t } = useI18n()

  const sections = computed<SyncSection[]>(() => {
    const p = libraryStore.syncProgress
    const opts = libraryStore.syncOptions
    const book = libraryStore.currentBookInfo
    const finished = isFinished.value
    const list: SyncSection[] = []

    const pagePercent = p.pagesTotal > 0
      ? Math.min(100, Math.round((p.pagesDone / p.pagesTotal) * 100))
      : 0

    appendPagesSection(
      list,
      opts,
      p,
      finished,
      pagePercent,
      t('bookInfo.pages'),
    )
    appendSentencesSection(
      list,
      opts,
      p,
      finished,
      pagePercent,
      t('bookInfo.sentences'),
      book,
    )
    appendWordsSection(
      list,
      opts,
      p,
      finished,
      pagePercent,
      t('analysis.words'),
      book,
    )
    appendTtsSection(
      list,
      opts,
      p,
      finished,
      pagePercent,
      t('reader.voiceTts'),
      book,
    )

    return list
  })

  return {
    sections,
  }
}
