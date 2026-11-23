import type { Plugin, Rule } from 'postcss'
import type { Selector } from 'postcss-selector-parser'
import selectorParser from 'postcss-selector-parser'

const hoverQuery = '(hover: hover) and (pointer: fine)'

function isGuarded(rule: Rule): boolean {
  for (let parent = rule.parent; parent?.type === 'atrule'; parent = parent.parent) {
    if (parent.name === 'media' && parent.params === hoverQuery)
      return true
  }

  return false
}

// Vue's scoping selectors are unwrapped later in the CSS pipeline.
const transparentPseudos = new Set([':deep', ':global', ':slotted', '::v-deep', '::v-global', '::v-slotted'])

function requiresHover(selector: Selector): boolean {
  return selector.nodes.some((node) => {
    if (node.type !== 'pseudo')
      return false

    const name = node.value.toLowerCase()

    return name === ':hover' || (transparentPseudos.has(name) && node.nodes.length > 0 && node.nodes.every(requiresHover))
  })
}

/** Apply the same hover policy to plain CSS and compiled Sass. */
export const hoverCapability: Plugin = {
  postcssPlugin: 'insight-hover-capability',
  Once(root, { AtRule }) {
    root.walkRules(/:hover\b/, (rule) => {
      if (isGuarded(rule))
        return

      const hover: string[] = []
      const other: string[] = []

      for (const selector of selectorParser().astSync(rule.selector).nodes) {
        const group = requiresHover(selector) ? hover : other
        group.push(selector.toString())
      }

      if (!hover.length)
        return

      const media = new AtRule({ name: 'media', params: hoverQuery, source: rule.source })
      media.append(rule.clone({ selectors: hover }))
      rule.after(media)

      if (other.length)
        rule.selectors = other
      else
        rule.remove()
    })
  },
}

export const hoverCapabilityPostcss = { plugins: [hoverCapability] }
