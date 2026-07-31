import type { Book } from '~/01.shared/types/models'

export interface DisplayGroup {
  seriesName: string
  isFolderContent?: boolean
  icon?: string
  books?: Book[]
  folders?: { name: string, count: number }[]
}
