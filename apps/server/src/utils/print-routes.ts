import type { ServeOptionsRoutes } from 'bun'

function logRoutes(routes: ServeOptionsRoutes, port: number) {
  console.log(`🚀 Available routes on http://localhost:${port}:`)
  for (const path in routes) {
    const methods = Object.keys(routes[path])
      .filter(method => method !== 'OPTIONS')
      .join(', ')

    if (methods)
      console.log(`  [${methods.padEnd(15)}] ${path}`)
  }
}

export { logRoutes }
