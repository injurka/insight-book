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

export interface CatalogPlugin {
  id: string
  name: string
  version: string
  description: string | null
  icon: string | null
  author: string | null
  sourceUrl: string | null
  manifestUrl: string
  uploadedBy: number | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  updatedAt: string
}
