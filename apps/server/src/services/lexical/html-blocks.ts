import type { AnyNode, Text } from 'domhandler'

export function collectTextBlocks(roots: AnyNode[]) {
  const blocks: { textNodes: Text[], fullText: string }[] = []
  let currentBlock: { textNodes: Text[], fullText: string } = { textNodes: [], fullText: '' }

  function traverse(el: AnyNode) {
    // eslint-disable-next-line regexp/no-unused-capturing-group
    const isBlock = el.type === 'tag' && /^(p|div|h[1-6]|li|blockquote|td|th|br|hr|tr|ul|ol|table|article|section|main|aside|nav|header|footer|pre|figure|figcaption)$/i.test(el.name)

    if (isBlock && currentBlock.textNodes.length > 0) {
      blocks.push(currentBlock)
      currentBlock = { textNodes: [], fullText: '' }
    }

    if (el.type === 'text') {
      const text = el.data
      if (text) {
        currentBlock.textNodes.push(el as Text)
        currentBlock.fullText += text
      }
    }
    else if (el.type === 'tag' && el.children) {
      el.children.forEach(traverse)
    }

    if (isBlock && currentBlock.textNodes.length > 0) {
      blocks.push(currentBlock)
      currentBlock = { textNodes: [], fullText: '' }
    }
  }

  roots.forEach(traverse)
  if (currentBlock.textNodes.length > 0)
    blocks.push(currentBlock)

  return blocks
}
