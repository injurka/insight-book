export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function highlightTextQuery(text: string | null | undefined, query: string): string {
  if (!text)
    return ''
  const trimmedQuery = query.trim()
  if (!trimmedQuery)
    return escapeHtml(text)

  const re = new RegExp(escapeRegExp(trimmedQuery), 'gi')
  let result = ''
  let lastIndex = 0

  text.replace(re, (match, offset) => {
    result += escapeHtml(text.slice(lastIndex, offset))
    result += `<mark class="text-match">${escapeHtml(match)}</mark>`
    lastIndex = offset + match.length

    return match
  })
  result += escapeHtml(text.slice(lastIndex))

  return result
}

export function normalizeString(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[\s\p{P}]+/gu, '')
}
