import 'fake-indexeddb/auto'
import '@testing-library/jest-dom'
import { MotionGlobalConfig } from 'motion/react'

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
