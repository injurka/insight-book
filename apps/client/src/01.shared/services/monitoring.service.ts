import { getWebInstrumentations, initializeFaro } from '@grafana/faro-web-sdk'
import { FARO_URL } from '~/01.shared/lib/env'

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
    ],
  })
}
