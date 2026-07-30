import 'fake-indexeddb/auto'
import '@testing-library/jest-dom'

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
