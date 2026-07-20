import { logger } from '../utils/logger'

function logRoutes(routes: Record<string, Record<string, unknown>>, port: number) {
  logger.info(`🚀 Available routes on http://localhost:${port}:`)
  for (const path in routes) {
    const methods = Object.keys(routes[path])
      .filter(method => method !== 'OPTIONS')
      .join(', ')

    if (methods)
      logger.info(`  [${methods.padEnd(15)}] ${path}`)
  }
}

export { logRoutes }
