export const CATALOG_PLUGIN_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const

export type CatalogPluginStatus = typeof CATALOG_PLUGIN_STATUS[keyof typeof CATALOG_PLUGIN_STATUS]
