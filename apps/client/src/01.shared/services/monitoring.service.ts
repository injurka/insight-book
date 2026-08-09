import type { App } from 'vue'
import type { Router } from 'vue-router'
import { faro, getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk'
import { TracingInstrumentation } from '@grafana/faro-web-tracing'
import { API_URL, FARO_URL } from '~/01.shared/lib/env'

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
      version: '1.0.0',
      environment: import.meta.env.MODE || 'production',
    },
    instrumentations: [
      ...getWebInstrumentations(),
      new TracingInstrumentation({
        instrumentationOptions: {
          propagateTraceHeaderCorsUrls: API_URL
            ? [new RegExp(API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))]
            : [],
        },
      }),
    ],
  })
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
    // Устанавливаем View в Faro SDK
    faro.api.setView({
      name: pageName,
    })
    // Отправляем явное событие page_view для гарантированного попадания в аналитику
    faro.api.pushEvent('page_view', {
      page_name: pageName,
      path: to.fullPath,
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
