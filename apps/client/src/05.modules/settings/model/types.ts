export interface ActionStats {
  action: string
  input: number
  output: number
  cost: number
  audioInputSeconds?: number
  audioOutputSeconds?: number
}

export interface BookCacheStat {
  id: string
  title: string
  totalPages: number
  cachedPages: number[]
  analysesCount: number
  sizeBytes: number
  imagesCount: number
  ttsCount: number
  dictPagesCount: number
}

export interface PageRange {
  start: number
  end: number
}
