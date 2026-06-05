export interface ChapterInfo {
  title: string
  url: string
  pages: number
}

export interface ChapterGroup {
  name: string
  chapters: ChapterInfo[]
}

export interface MangaInfo {
  title: string
  coverUrl: string
  groups: ChapterGroup[]
}
