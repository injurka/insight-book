/* eslint-disable regexp/no-super-linear-backtracking */
import DOMPurify from 'dompurify'

export function formatMarkdown(text: string): string {
  if (!text)
    return ''

  let processed = text.trim()
  const blocks: string[] = []

  // 1. Извлекаем и форматируем многострочные блоки кода
  processed = processed.replace(/```([a-z]*)\s*([\s\S]*?)```/gi, (_, _lang, codeContent) => {
    const escaped = codeContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const formattedCode = `<pre class="chat-code-block"><code class="chat-code">${escaped}</code></pre>`
    const placeholder = `__BLOCK_PLACEHOLDER_${blocks.length}__`
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
    const placeholder = `__BLOCK_PLACEHOLDER_${blocks.length}__`
    blocks.push(formattedCode)
    return placeholder
  })

  // 3. Базовый Markdown (жирный, курсив, заголовки)
  processed = processed
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')

  // 4. Списки: превращаем строки с дефисами или звездочками в <li>
  processed = processed.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>')

  // Оборачиваем группы <li> в родительский <ul>
  processed = processed.replace(/(?:<li>.*?<\/li>\s*)+/g, match => `<ul>${match}</ul>`)

  // 5. Заменяем переносы строк на <br> для обычного текста
  processed = processed.replace(/\n/g, '<br>')

  // Очищаем лишние <br> внутри и вокруг блочных элементов (чтобы списки не разъезжались)
  processed = processed.replace(/(<\/h[1-6]>|<\/ul>|<\/li>|<br>)(<br>)+/g, '$1')
  processed = processed.replace(/<ul><br>/g, '<ul>')
  processed = processed.replace(/<\/li><br>/g, '</li>')

  // 6. Возвращаем блоки кода на место
  for (let i = 0; i < blocks.length; i++) {
    processed = processed.replace(`__BLOCK_PLACEHOLDER_${i}__`, blocks[i])
  }

  // Очищаем итоговый HTML для безопасности (DOMPurify сохраняет нужные нам теги)
  return DOMPurify.sanitize(processed)
}
