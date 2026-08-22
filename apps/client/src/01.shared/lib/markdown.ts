/* eslint-disable regexp/no-super-linear-backtracking */
import DOMPurify from 'dompurify'

function splitTableRow(line: string): string[] {
  let trimmed = line.trim()
  if (trimmed.startsWith('|'))
    trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|'))
    trimmed = trimmed.slice(0, -1)

  return trimmed.split('|').map(s => s.trim())
}

function isTableDelimiter(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed.includes('-') || !trimmed.includes('|'))
    return false
  const cells = splitTableRow(trimmed)

  return cells.length > 0 && cells.every(c => /^:?-{2,}:?$/.test(c))
}

function getTableAlignment(cell: string): 'left' | 'center' | 'right' | '' {
  const trimmed = cell.trim()
  if (trimmed.startsWith(':') && trimmed.endsWith(':'))
    return 'center'
  if (trimmed.endsWith(':'))
    return 'right'
  if (trimmed.startsWith(':'))
    return 'left'

  return ''
}

function renderHtmlTable(headerCells: string[], delimiterCells: string[], bodyRows: string[][]): string {
  const alignments = delimiterCells.map(getTableAlignment)
  const thead = `<thead><tr>${headerCells
    .map((c, idx) => {
      const align = alignments[idx] ? ` align="${alignments[idx]}"` : ''

      return `<th${align}>${c}</th>`
    })
    .join('')}</tr></thead>`

  const tbody = `<tbody>${bodyRows
    .map(row => `<tr>${headerCells
      .map((_, colIdx) => {
        const cell = row[colIdx] ?? ''
        const align = alignments[colIdx] ? ` align="${alignments[colIdx]}"` : ''

        return `<td${align}>${cell}</td>`
      })
      .join('')}</tr>`)
    .join('')}</tbody>`

  return `<table class="markdown-table">${thead}${tbody}</table>`
}

function parseTableBlock(lines: string[], startIndex: number): { html: string, nextIndex: number } | null {
  if (startIndex + 1 >= lines.length || !lines[startIndex].includes('|') || !isTableDelimiter(lines[startIndex + 1]))
    return null

  const headerCells = splitTableRow(lines[startIndex])
  const delimiterCells = splitTableRow(lines[startIndex + 1])

  if (headerCells.length === 0 || headerCells.length !== delimiterCells.length)
    return null

  const bodyRows: string[][] = []
  let i = startIndex + 2

  while (i < lines.length && lines[i].includes('|') && lines[i].trim().length > 0) {
    if (isTableDelimiter(lines[i]))
      break
    bodyRows.push(splitTableRow(lines[i]))
    i++
  }

  return {
    html: renderHtmlTable(headerCells, delimiterCells, bodyRows),
    nextIndex: i,
  }
}

function parseMarkdownTables(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let i = 0

  while (i < lines.length) {
    const table = parseTableBlock(lines, i)
    if (table) {
      result.push(table.html)
      i = table.nextIndex
      continue
    }

    result.push(lines[i])
    i++
  }

  return result.join('\n')
}

export function formatMarkdown(text: string): string {
  if (!text)
    return ''

  let processed = text.trim()
  const blocks: string[] = []

  // 1. Извлекаем и форматируем многострочные блоки кода
  processed = processed.replace(/```([a-z]*)\s*([\s\S]*?)```/gi, (_, lang, codeContent) => {
    const escaped = codeContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    const langClass = lang ? `language-${lang.toLowerCase()}` : 'language-javascript'
    const formattedCode = `<pre class="chat-code-block ${langClass}"><code class="chat-code ${langClass}">${escaped}</code></pre>`
    const placeholder = `%%BLOCK_PLACEHOLDER_${blocks.length}%%`
    blocks.push(formattedCode)

    return placeholder
  })

  // 2. Извлекаем инлайн-код
  processed = processed.replace(/`([^`]+)`/g, (_, inlineCode) => {
    const escaped = inlineCode
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const formattedCode = `<code class="chat-code">${escaped}</code>`
    const placeholder = `%%BLOCK_PLACEHOLDER_${blocks.length}%%`
    blocks.push(formattedCode)

    return placeholder
  })

  // 3. Экранируем сырой HTML во входном тексте
  processed = processed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // 4. Таблицы
  processed = parseMarkdownTables(processed)

  // 5. Разделители (---, ***, ___)
  processed = processed.replace(/^\s*[-*_]{3,}\s*$/gm, '<hr>')

  // 6. Заголовки
  processed = processed
    .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')

  // 7. Цитаты
  processed = processed.replace(/^\s*(?:>|&gt;)\s*(.*)$/gm, '<bq-line>$1</bq-line>')
  processed = processed.replace(/(?:<bq-line>.*?<\/bq-line>\s*)+/g, (match) => {
    const inner = match.replace(/<bq-line>(.*?)<\/bq-line>\s*/g, '$1<br>').replace(/<br>$/, '')

    return `<blockquote>${inner}</blockquote>`
  })

  // 8. Списки
  // Неупорядоченные списки
  processed = processed.replace(/^\s*[-*]\s+(.*)$/gm, '<ul-li>$1</ul-li>')
  processed = processed.replace(/(?:<ul-li>.*?<\/ul-li>\s*)+/g, match => `<ul>${match.replace(/ul-li>/g, 'li>')}</ul>`)

  // Упорядоченные / нумерованные списки
  processed = processed.replace(/^\s*\d+\.\s+(.*)$/gm, '<ol-li>$1</ol-li>')
  processed = processed.replace(/(?:<ol-li>.*?<\/ol-li>\s*)+/g, match => `<ol>${match.replace(/ol-li>/g, 'li>')}</ol>`)

  // 9. Жирный и курсив
  processed = processed
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')

  // 10. Заменяем переносы строк на <br> для обычного текста
  processed = processed.replace(/\n/g, '<br>')

  // Очищаем лишние <br> внутри и вокруг блочных элементов
  processed = processed.replace(/(<\/h[1-6]>|<\/ul>|<\/ol>|<\/li>|<\/blockquote>|<\/table>|<hr>|<br>)(<br>)+/g, '$1')
  processed = processed.replace(/(<br>)+(<h[1-6]>|<ul>|<ol>|<blockquote>|<table|<hr)/g, '$2')
  processed = processed.replace(/<ul><br>/g, '<ul>')
  processed = processed.replace(/<ol><br>/g, '<ol>')
  processed = processed.replace(/<\/li><br>/g, '</li>')
  processed = processed.replace(/<blockquote><br>/g, '<blockquote>')
  processed = processed.replace(/<\/blockquote><br>/g, '</blockquote>')
  processed = processed.replace(/<table([^>]*)><br>/g, '<table$1>')
  processed = processed.replace(/<\/table><br>/g, '</table>')
  processed = processed.replace(/<tr><br>/g, '<tr>')
  processed = processed.replace(/<\/tr><br>/g, '</tr>')
  processed = processed.replace(/<th><br>/g, '<th>')
  processed = processed.replace(/<\/th><br>/g, '</th>')
  processed = processed.replace(/<td><br>/g, '<td>')
  processed = processed.replace(/<\/td><br>/g, '</td>')

  // 11. Возвращаем блоки кода на место
  for (let i = 0; i < blocks.length; i++)
    processed = processed.replace(`%%BLOCK_PLACEHOLDER_${i}%%`, blocks[i])

  // 12. Очищаем итоговый HTML для безопасности
  return DOMPurify.sanitize(processed, {
    ALLOWED_TAGS: [
      'strong',
      'em',
      'h1',
      'h2',
      'h3',
      'h4',
      'ul',
      'ol',
      'li',
      'br',
      'hr',
      'pre',
      'code',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'blockquote',
    ],
    ALLOWED_ATTR: ['class', 'align'],
  })
}
