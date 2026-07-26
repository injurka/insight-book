import type { Book, Highlight } from '~/shared/types/models'
import { useI18n } from 'vue-i18n'

export interface BookGroup {
  book: Book
  highlights: Highlight[]
  lastActivityDate: string
}

export function useNotebookExport() {
  const { t } = useI18n()

  function exportToMarkdown(group: BookGroup) {
    const { book, highlights } = group
    let content = `${t('notebook.exportMd.title') || '# Цитаты из книги:'} ${book.title}\n`
    if (book.author) {
      content += `${t('notebook.exportMd.author') || '**Автор**:'} ${book.author}\n`
    }
    content += `${t('notebook.exportMd.totalQuotes') || '**Всего цитат**:'} ${highlights.length}\n\n---\n\n`

    highlights.forEach((h, index) => {
      content += `### ${index + 1}. ${t('notebook.exportMd.quoteHeader') || 'Цитата'}\n`
      content += `> "${h.text}"\n\n`
      if (h.translation) {
        content += `*${t('notebook.exportMd.translationHeader') || 'Перевод'}*: ${h.translation}\n\n`
      }
      if (h.note) {
        content += `*${t('notebook.exportMd.noteHeader') || 'Заметка'}*: ${h.note}\n\n`
      }
      if (h.chapter || h.pageNum) {
        const meta = []
        if (h.chapter)
          meta.push(`${t('notebook.chapter', { chapter: h.chapter })}`)
        if (h.pageNum)
          meta.push(`${t('notebook.page', { page: h.pageNum })}`)
        content += `_${meta.join(' | ')}_\n\n`
      }
      content += `---\n\n`
    })

    downloadFile(content, `${book.title}_quotes.md`, 'text/markdown;charset=utf-8')
  }

  function exportToPlainText(group: BookGroup) {
    const { book, highlights } = group
    let content = `${book.title}\n`
    if (book.author) {
      content += `${t('notebook.exportMd.author') || 'Автор'}: ${book.author}\n`
    }
    content += `${t('notebook.exportMd.totalQuotes') || 'Всего цитат'}: ${highlights.length}\n\n`

    highlights.forEach((h, index) => {
      content += `${index + 1}. "${h.text}"\n`
      if (h.translation) {
        content += `   Перевод: ${h.translation}\n`
      }
      if (h.note) {
        content += `   Заметка: ${h.note}\n`
      }
      content += `\n`
    })

    downloadFile(content, `${book.title}_quotes.txt`, 'text/plain;charset=utf-8')
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    exportToMarkdown,
    exportToPlainText,
  }
}
