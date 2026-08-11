import { corsHeadersFor } from '../config'

export function withCors(response: Response, origin: string | null = null, requestHeaders?: string | null): Response {
  const headers = new Headers(response.headers)

  for (const [key, value] of Object.entries(corsHeadersFor(origin, requestHeaders))) {
    headers.set(key, value)
  }

  return new Response(response.body, { status: response.status, headers })
}
