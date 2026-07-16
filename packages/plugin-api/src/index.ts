import type { Component } from 'vue'

export interface InsightBookPluginEventBus {
  on(event: string, callback: (data: any) => void): void
  off(event: string, callback: (data: any) => void): void
  emit(event: string, data?: any): void
}

export interface InsightBookPluginContext {
  /** Display a notification to the user */
  notify: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
  /** Adds an item to the app's main navigation menu */
  addNavigationItem: (item: { title: string, icon?: string, routeName: string }) => void
  /** Communication channel between plugins and core system */
  events: InsightBookPluginEventBus
}

export interface InsightBookPlugin {
  /** Unique plugin identifier (kebab-case) */
  id: string
  /** Human-readable plugin name */
  name: string
  /** Plugin version */
  version: string
  /** Brief description of the plugin */
  description?: string
  /** Plugin icon (e.g. mdi:book) */
  icon?: string

  /**
   * Pages exposed by the plugin.
   * Key: route path relative to `/plugin/:pluginId/` (use 'index' for the root of the plugin)
   * Value: Vue Component
   */
  pages?: Record<string, Component>

  /** Lifecycle hook: called when plugin is activated */
  activate?: (ctx: InsightBookPluginContext) => void | Promise<void>

  /** Lifecycle hook: called when plugin is deactivated */
  deactivate?: (ctx: InsightBookPluginContext) => void | Promise<void>
}
