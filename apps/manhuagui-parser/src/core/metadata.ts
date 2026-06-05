import { writeFileSync } from 'node:fs'
import path from 'node:path'

export interface BookmarkInfo {
  pageIndex: number
  title: string
}

export function writeComicInfo(
  mangaDir: string,
  title: string,
  pageCount: number,
  bookmarks: BookmarkInfo[]
) {
  // Экранируем спецсимволы для XML
  const escapeXml = (unsafe: string) =>
    unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;'
        case '>': return '&gt;'
        case '&': return '&amp;'
        case '\'': return '&apos;'
        case '"': return '&quot;'
        default: return c
      }
    })

  let pagesXml = bookmarks.map(b =>
    `    <Page Image="${b.pageIndex}" Bookmark="${escapeXml(b.title)}" />`
  ).join('\n')

  if (bookmarks.length === 0 || bookmarks[0].pageIndex !== 0) {
    pagesXml = `    <Page Image="0" Type="FrontCover" />\n${pagesXml}`
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Title>${escapeXml(title)}</Title>
  <PageCount>${pageCount}</PageCount>
  <RightToLeft>Yes</RightToLeft>
  <Manga>YesAndRightToLeft</Manga>
  <Pages>
${pagesXml}
  </Pages>
</ComicInfo>`

  writeFileSync(path.join(mangaDir, 'ComicInfo.xml'), xml, 'utf-8')
}
