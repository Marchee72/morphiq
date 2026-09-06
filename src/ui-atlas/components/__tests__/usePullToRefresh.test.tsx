import { useRef } from 'react';
import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { usePullToRefresh } from '../usePullToRefresh';

/**
 * The gesture's rules, which are the whole of it: only from the top, only
 * downward, only past the threshold, and never twice at once.
 */

const THRESHOLD = 72;
/** Resistance is 0.55, so the finger has to travel further than the badge does. */
const travelFor = (pull: number) => Math.ceil(pull / 0.55) + 1;

function Harness({ onRefresh, enabled = true }: { onRefresh: () => Promise<unknown>; enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { state } = usePullToRefresh(ref, onRefresh, enabled);
  return <div ref={ref} data-testid="scroller" data-state={state} style={{ height: 100, overflowY: 'auto' }} />;
}

/** A touch event jsdom will carry — it has no TouchEvent constructor of its own. */
function touch(el: HTMLElement, type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: type === 'touchmove' });
  Object.defineProperty(event, 'touches', {
    value: type === 'touchend' || type === 'touchcancel' ? [] : [{ clientX: x, clientY: y }],
  });
  act(() => { el.dispatchEvent(event); });
  return event;
}

describe('usePullToRefresh', () => {
  let scroller: HTMLElement;
  let onRefresh: Mock<() => Promise<unknown>>;

  const setup = (enabled = true) => {
    onRefresh = vi.fn<() => Promise<unknown>>(() => Promise.resolve());
    const { getByTestId } = render(<Harness onRefresh={onRefresh} enabled={enabled} />);
    scroller = getByTestId('scroller');
    return scroller;
  };

  beforeEach(() => { vi.restoreAllMocks(); });

  it('fires once the pull passes the threshold', async () => {
    setup();
    touch(scroller, 'touchstart', 100, 100);
    touch(scroller, 'touchmove', 100, 100 + travelFor(THRESHOLD));
    touch(scroller, 'touchend', 100, 100 + travelFor(THRESHOLD));

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
  });

  it('does not fire on a pull that stops short of the threshold', () => {
    setup();
    touch(scroller, 'touchstart', 100, 100);
    touch(scroller, 'touchmove', 100, 100 + travelFor(THRESHOLD - 20));
    touch(scroller, 'touchend', 100, 100 + travelFor(THRESHOLD - 20));

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('ignores a pull that did not start at the top of the scroller', () => {
    setup();
    // Mid-list. Flicking back to the top must not arm a refresh nobody asked
    // for, so the start position decides and is never re-evaluated.
    Object.defineProperty(scroller, 'scrollTop', { value: 240, configurable: true });

    touch(scroller, 'touchstart', 100, 100);
    touch(scroller, 'touchmove', 100, 100 + travelFor(THRESHOLD));
    touch(scroller, 'touchend', 100, 100 + travelFor(THRESHOLD));

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('gives up on a finger that travels further sideways than down', () => {
    setup();
    // The horizontal swipe that changes exercise on Train starts exactly like
    // this, and must not be swallowed.
    touch(scroller, 'touchstart', 100, 100);
    touch(scroller, 'touchmove', 260, 120);
    touch(scroller, 'touchmove', 260, 100 + travelFor(THRESHOLD));
    touch(scroller, 'touchend', 260, 100 + travelFor(THRESHOLD));

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not swallow the touch until the gesture has committed', () => {
    setup();
    touch(scroller, 'touchstart', 100, 100);
    // Inside the slop: still a scroll, so the scroller must keep it.
    const early = touch(scroller, 'touchmove', 100, 103);
    expect(early.defaultPrevented).toBe(false);

    // Past it: the page is following the finger now, so the scroller must not.
    const committed = touch(scroller, 'touchmove', 100, 140);
    expect(committed.defaultPrevented).toBe(true);
  });

  it('reports the states the badge renders from', () => {
    setup();
    expect(scroller.dataset.state).toBe('idle');

    touch(scroller, 'touchstart', 100, 100);
    touch(scroller, 'touchmove', 100, 100 + travelFor(20));
    expect(scroller.dataset.state).toBe('pulling');

    touch(scroller, 'touchmove', 100, 100 + travelFor(THRESHOLD));
    expect(scroller.dataset.state).toBe('armed');
  });

  it('will not start a second sync while one is running', async () => {
    let release: () => void = () => {};
    onRefresh = vi.fn<() => Promise<unknown>>(() => new Promise<void>(res => { release = res; }));
    const { getByTestId } = render(<Harness onRefresh={onRefresh} />);
    scroller = getByTestId('scroller');

    const pull = () => {
      touch(scroller, 'touchstart', 100, 100);
      touch(scroller, 'touchmove', 100, 100 + travelFor(THRESHOLD));
      touch(scroller, 'touchend', 100, 100 + travelFor(THRESHOLD));
    };

    pull();
    await waitFor(() => expect(scroller.dataset.state).toBe('refreshing'));
    pull();
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await act(async () => { release(); });
    await waitFor(() => expect(scroller.dataset.state).toBe('idle'));
  });

  it('attaches nothing when disabled, which is how Train opts out', () => {
    setup(false);
    touch(scroller, 'touchstart', 100, 100);
    touch(scroller, 'touchmove', 100, 100 + travelFor(THRESHOLD));
    touch(scroller, 'touchend', 100, 100 + travelFor(THRESHOLD));

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
