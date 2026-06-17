// eslint-disable-next-line ts/ban-ts-comment
// @ts-nocheck
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('limits UI and Settings Panel Styles', () => {
  it('verifies limits.vue has correct background theming variables for ai-icon and book-icon', () => {
    const limitsPath = resolve(__dirname, './limits.vue')
    const content = readFileSync(limitsPath, 'utf8')

    // Verify .ai-icon and .book-icon use RGB variables for transparent background
    expect(content).toContain('background-color: rgba(var(--fg-accent-color-rgb), 0.1);')
    expect(content).toContain('background-color: rgba(var(--fg-success-color-rgb), 0.1);')
  })

  it('verifies limits.vue has correct media queries and breakpoints for .limits-grid and .limit-card', () => {
    const limitsPath = resolve(__dirname, './limits.vue')
    const content = readFileSync(limitsPath, 'utf8')

    // Verify limits-grid has media-down(md) for 1fr column responsiveness
    const gridMediaMatch = /\.limits-grid[\s\S]*?@include\s+media-down\(md\)\s*\{\s*grid-template-columns:\s*1fr;?\s*\}/.test(content)
    expect(gridMediaMatch).toBe(true)

    // Verify limit-card has media-down(xs) for reduced padding
    const cardMediaMatch = /\.limit-card[\s\S]*?@include\s+media-down\(xs\)\s*\{\s*padding:\s*16px;?\s*\}/.test(content)
    expect(cardMediaMatch).toBe(true)
  })

  it('verifies settings-tokens-panel.vue has overflow: hidden on .model-details-container', () => {
    const panelPath = resolve(__dirname, '../components/05.modules/settings/ui/panels/settings-tokens-panel.vue')
    const content = readFileSync(panelPath, 'utf8')

    // Verify model-details-container has overflow: hidden to prevent layout border leaks
    const containerMatch = /\.model-details-container[\s\S]*?overflow:\s*hidden;?/.test(content)
    expect(containerMatch).toBe(true)
  })

  it('verifies light and dark theme variable definitions exist for accent and success colors', () => {
    const lightPath = resolve(__dirname, '../assets/scss/themes/light/_variables.scss')
    const darkPath = resolve(__dirname, '../assets/scss/themes/dark/_variables.scss')

    const lightContent = readFileSync(lightPath, 'utf8')
    const darkContent = readFileSync(darkPath, 'utf8')

    // Light theme variables check
    expect(lightContent).toContain('$fg-accent-color:')
    expect(lightContent).toContain('$fg-success-color:')

    // Dark theme variables check
    expect(darkContent).toContain('$fg-accent-color:')
    expect(darkContent).toContain('$fg-success-color:')
  })

  it('verifies css-variables.scss generates RGB channels dynamically', () => {
    const cssVarsPath = resolve(__dirname, '../assets/scss/_css-variables.scss')
    const content = readFileSync(cssVarsPath, 'utf8')

    // Verify the rgb channel mapping loops over colors
    expect(content).toContain('--#{$colorType}-color-rgb:')
    expect(content).toContain('color.channel($colorValue, "red", $space: rgb)')
  })
})
