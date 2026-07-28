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

export interface VolumeConfig {
  title: string
  start: number
  end: number
  description?: string
}

export interface MangaConfig {
  url?: string
  series?: string
  groups?: string[]
  volumes: VolumeConfig[]
}
