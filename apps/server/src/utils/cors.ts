import { CORS_HEADERS } from '../config'

export function withCors(response: Response): Response {
  const headers = new Headers(response.headers)

  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value)
  }

  return new Response(response.body, { status: response.status, headers })
}
