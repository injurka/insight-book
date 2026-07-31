import type { Book, Highlight } from '~/01.shared/types/models'

export interface BookGroup {
  book: Book
  highlights: Highlight[]
  lastActivityDate: string
}

export interface NotebookHeaderItem {
  id: string
  kind: 'header'
  group: BookGroup
}

export interface NotebookHighlightItem {
  id: string
  kind: 'highlight'
  highlight: Highlight
  group: BookGroup
}

export type NotebookFlatItem = NotebookHeaderItem | NotebookHighlightItem
