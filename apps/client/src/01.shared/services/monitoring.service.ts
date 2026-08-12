import type { App } from 'vue'
import type { Router } from 'vue-router'
import {
  faro,
  getWebInstrumentations,
  initializeFaro,
} from '@grafana/faro-web-sdk'
import { API_URL, FARO_URL } from '~/01.shared/lib/env'
import packageJson from '../../../package.json'

export type FaroEventName
  = | 'theme_changed'
    | 'custom_llm_enabled'
    | 'tts_speed_changed'
    | 'reader_font_size_changed'
    | 'reader_font_family_changed'
    | 'manga_ocr_mode_changed'
    | 'app_language_changed'
    | 'pwa_installed'
    | 'tts_played'
    | 'ai_analyze'
    | 'page_analysis_started'
    | 'ai_translation_requested'
    | 'ai_word_lookup'
    | 'word_saved_to_dict'
    | 'word_removed_from_dict'
    | 'logout'
    | 'login_success'
    | 'register_success'
    | 'app_error'
    | 'anki_export_downloaded'
    | 'deck_created'
    | 'deck_updated'
    | 'deck_deleted'
    | 'bulk_words_deleted'
    | 'bulk_words_moved'
    | 'book_sync_started'
    | 'public_book_search'
    | 'public_book_downloaded'
    | 'book_full_analysis_started'
    | 'vocabulary_analysis_started'
    | 'book_uploaded'
    | 'custom_manga_created'
    | 'book_deleted'
    | 'reading_session_ended'
    | 'parallel_view_toggled'
    | 'toc_opened'
    | 'page_loaded'
    | 'book_opened'
    | 'srs_training_started'
    | 'srs_training_finished'
    | 'page_view'
    | (string & {})

/** Наблюдает Server-Timing метрики через PerformanceObserver и отправляет их в Faro */
export function setupServerTimingObserver() {
  if (!('PerformanceObserver' in window))
    return

  // Экранируем API_URL для использования в RegExp
  const apiPattern = API_URL
    ? new RegExp(`^${API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
    : null

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Фильтруем только запросы к нашему API
        if (apiPattern && !apiPattern.test(entry.name))
          continue

        const serverTiming = (entry as PerformanceResourceTiming).serverTiming
        if (!serverTiming || serverTiming.length === 0)
          continue

        // Собираем метрики в плоский объект
        const metrics: Record<string, number> = {}
        for (const st of serverTiming) {
          metrics[st.name] = st.duration
        }

        if (Object.keys(metrics).length === 0)
          continue

        // Отправляем в Faro как измерение (measurement)
        if (faro.api) {
          faro.api.pushMeasurement({
            type: 'server-timing',
            values: metrics,
          }, {
            context: {
              url: entry.name,
              entry_type: entry.entryType,
            },
          })
        }
      }
    })

    // Наблюдаем navigation (основные запросы страниц) и resource (fetch/XHR)
    observer.observe({ type: 'navigation', buffered: true })
    observer.observe({ type: 'resource', buffered: true })
  }
  catch {
    // Server Timing API не поддерживается браузером — молча пропускаем
  }
}

export function initMonitoring() {
  if (!FARO_URL)
    return

  const targetUrl = FARO_URL.endsWith('/collect')
    ? FARO_URL
    : `${FARO_URL.replace(/\/+$/, '')}/collect`

  initializeFaro({
    url: targetUrl,
    app: {
      name: 'insight-book-client',
      version: packageJson.version,
      environment: import.meta.env.MODE,
    },
    instrumentations: [
      ...getWebInstrumentations(),
    ],
    batching: {
      enabled: true,
      sendTimeout: 5_000,
      itemLimit: 100,
    },
    requestCompression: true,
    // beforeSend: (item) => {
    //   // В dev-режиме не шлём поток телеметрии — только ошибки
    //   if (import.meta.env.DEV && item.type !== TransportItemType.EXCEPTION)
    //     return null

    //   return item
    // },
  })

  setupServerTimingObserver()
}

export function setupVueMonitoring(app: App, router: Router) {
  if (!faro.api)
    return

  const originalErrorHandler = app.config.errorHandler
  app.config.errorHandler = (err, instance, info) => {
    if (err instanceof Error) {
      faro.api.pushError(err, {
        context: {
          vue_component: instance?.$options?.name || instance?.$options?.__name || 'UnknownComponent',
          vue_info: String(info),
        },
      })
    }
    else {
      faro.api.pushError(new Error(String(err)), {
        context: {
          vue_info: String(info),
        },
      })
    }

    if (originalErrorHandler) {
      originalErrorHandler(err, instance, info)
    }
  }

  router.afterEach((to) => {
    const pageName = String(to.name || to.path)

    faro.api.setView({
      name: pageName,
    })
  })
}

export function setFaroUser(userData: { id: string | number, username?: string, role?: string }) {
  if (!faro.api)
    return

  faro.api.setUser({
    id: String(userData.id),
    username: userData.username,
    attributes: {
      role: userData.role || 'user',
    },
  })
}

export function resetFaroUser() {
  if (!faro.api)
    return

  faro.api.resetUser()
}

export function trackFaroEvent(name: FaroEventName, attributes?: Record<string, unknown>, domain?: string) {
  if (!faro.api)
    return

  const stringifiedAttrs: Record<string, string> = {
    event_name: name,
  }

  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== undefined && value !== null) {
        stringifiedAttrs[key] = typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)
      }
    }
  }

  faro.api.pushEvent(name, stringifiedAttrs, domain)
}

export function trackFaroError(error: Error | unknown, context?: Record<string, unknown>) {
  if (!faro.api)
    return

  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error))

  const stringifiedContext: Record<string, string> = {}
  if (context) {
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined && value !== null) {
        stringifiedContext[key] = typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)
      }
    }
  }

  faro.api.pushError(err, {
    context: stringifiedContext,
  })
}
