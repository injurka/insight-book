export function formatToDateTimeLocal(dateString?: string): string {
  if (!dateString)
    return ''
  return dateString.replace(' ', 'T').slice(0, 16)
}

export function parseFromDateTimeLocal(localString?: string): string {
  if (!localString)
    return ''
  return `${localString.replace('T', ' ')}:00`
}
