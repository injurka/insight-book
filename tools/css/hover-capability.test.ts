import { expect, it } from 'bun:test'
import postcss from 'postcss'
import { hoverCapability } from './hover-capability'

const processor = postcss([hoverCapability])

it('guards hover selectors without changing focus, pressed state, or cascade order', () => {
  const { root } = processor.process('.button:hover, .button:focus-visible, .button:active { color: red } .button { color: blue }')
  const [states, media, base] = root.nodes

  expect(states.type === 'rule' && states.selectors).toEqual(['.button:focus-visible', '.button:active'])
  expect(media.type === 'atrule' && media.params).toBe('(hover: hover) and (pointer: fine)')
  expect(media.toString()).toContain('.button:hover')
  expect(base.type === 'rule' && base.selector).toBe('.button')
})

it('preserves an existing hover guard and ignores attribute literals and negation', () => {
  const css = '@media (hover: hover) and (pointer: fine) { .button:hover { color: red } } [data-state=":hover"], .button:not(:hover) { color: blue }'

  expect(processor.process(css).css).toBe(css)
})

it('guards hover inside Vue scoped escape selectors', () => {
  const { root } = processor.process('.actions :deep(.button:hover:not(:disabled)) { color: red }')

  expect(root.first?.type).toBe('atrule')
  expect(root.first?.toString()).toContain(':deep(.button:hover:not(:disabled))')
})
