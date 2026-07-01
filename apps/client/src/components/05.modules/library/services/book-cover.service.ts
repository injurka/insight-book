import type { Book } from '~/shared/types/models'
import { offlineService } from '~/shared/services/offline.service'

export async function attachCachedCovers(booksArr: Book[]): Promise<void> {
  for (const b of booksArr) {
    if (!b)
      continue
    if (b.coverUrl && !b.localCoverUrl) {
      try {
        const cached = await offlineService.getCover(b.id)
        if (cached)
          b.localCoverUrl = URL.createObjectURL(cached)
      }
      catch { }
    }
  }
}
