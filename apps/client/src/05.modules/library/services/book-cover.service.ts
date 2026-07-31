import type { Book } from '~/01.shared/types/models'
import { useRepos } from '~/00.plugins/di'

const repos = useRepos()

export async function attachCachedCovers(booksArr: Book[]): Promise<void> {
  for (const b of booksArr) {
    if (!b)
      continue
    if (b.coverUrl && !b.localCoverUrl) {
      try {
        const cached = await repos.book.getLocalCover(b.id)
        if (cached)
          b.localCoverUrl = URL.createObjectURL(cached)
      }
      catch { }
    }
  }
}
