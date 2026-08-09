import type { App } from 'vue'
import type { Router } from 'vue-router'
import { faro, getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk'
import { TracingInstrumentation } from '@grafana/faro-web-tracing'
import { API_URL, FARO_URL } from '~/01.shared/lib/env'

export function initMonitoring() {
  if (!FARO_URL)
    return

  initializeFaro({
    url: FARO_URL,
    app: {
      name: 'insight-book-client',
      version: '1.0.0',
      environment: import.meta.env.MODE || 'production',
    },
    instrumentations: [
      ...getWebInstrumentations(),
      new TracingInstrumentation({
        instrumentationOptions: {
          propagateTraceHeaderCorsUrls: [
            new RegExp(API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
          ],
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
          vue_info: info,
        },
      })
    }
    else {
      faro.api.pushError(new Error(String(err)), {
        context: {
          vue_info: info,
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

export function trackFaroEvent(name: string, attributes?: Record<string, unknown>, domain?: string) {
  if (!faro.api)
    return

  const stringifiedAttrs: Record<string, string> = {}
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (value) {
        stringifiedAttrs[key] = typeof value === 'object'
          ? JSON.stringify(value)
          : String(value)
      }
    }
  }

  faro.api.pushEvent(name, stringifiedAttrs, domain)
}

export function trackFaroError(error: Error, context?: Record<string, string>) {
  if (!faro.api)
    return

  faro.api.pushError(error, {
    context,
  })
}
