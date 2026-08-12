export interface PendingPlugin {
  id: string
  name: string
  version: string
  description: string | null
  author: string | null
  sourceUrl: string | null
  manifestUrl: string
  uploadedBy: number | null
  createdAt: string
}
