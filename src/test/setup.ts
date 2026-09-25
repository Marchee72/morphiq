import 'fake-indexeddb/auto'
import '@testing-library/jest-dom'
import { MotionGlobalConfig } from 'motion/react'
import { vi } from 'vitest'

// Animations resolve instantly: jsdom has no frames to run them on, and a test
// asserting on the end state should not have to wait for a spring to settle.
MotionGlobalConfig.skipAnimations = true

/**
 * jsdom has no layout, so it implements no scrolling at all.
 *
 * A no-op rather than a guard in every component that scrolls: nothing here can
 * assert on it either way, and spreading `typeof el.scrollIntoView === 'function'`
 * through the UI would be working around the test environment in production code.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/**
 * NumberFlow's custom element never upgrades in jsdom, so its React wrapper
 * throws on the first update (`this.el.willUpdate is not a function`). Tests
 * read the number as text, which is what the element shows once it settles.
 */
vi.mock('@number-flow/react', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ value, locales, format, className }: {
      value: number; locales?: string; format?: Intl.NumberFormatOptions; className?: string
    }) => createElement('span', { className }, new Intl.NumberFormat(locales, format).format(value)),
  }
})
