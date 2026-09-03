import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { isOnline, reportReachable, reportUnreachable, resetConnectivity, subscribe } from '../connectivity';

/**
 * Whether the API is worth trying.
 *
 * `navigator.onLine` answers a different question than the one being asked: it
 * says whether the device has a network, not whether anything is at the far end
 * of it. Gym wifi behind a captive portal is "online" by that measure. So the
 * browser's answer is the coarse trigger and the last request's outcome is the
 * evidence that settles it.
 */

function setBrowserOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
  resetConnectivity();
  setBrowserOnline(true);
});

afterEach(() => {
  resetConnectivity();
  vi.unstubAllGlobals();
});

describe('isOnline', () => {
  it('believes a browser that says there is no network at all', async () => {
    setBrowserOnline(false);
    expect(isOnline()).toBe(false);
  });

  it('assumes reachable until something says otherwise', () => {
    // The app has to try once before it can know, and refusing to try would
    // make the first write of every launch go to the queue for no reason.
    expect(isOnline()).toBe(true);
  });

  it('believes a failed request over an optimistic browser', () => {
    // The captive-portal case: a network exists, nothing answers on it.
    reportUnreachable();
    expect(isOnline()).toBe(false);
  });

  it('recovers on the first request that gets through', () => {
    reportUnreachable();
    reportReachable();
    expect(isOnline()).toBe(true);
  });
});

describe('subscribers', () => {
  it('are told when the answer changes', () => {
    const listener = vi.fn();
    subscribe(listener);

    reportUnreachable();
    expect(listener).toHaveBeenCalledWith(false);

    reportReachable();
    expect(listener).toHaveBeenCalledWith(true);
  });

  it('are not woken for a repeat of what they already know', () => {
    // The flusher subscribes to this. Every spurious wake is a drain attempt
    // against a server that is still down.
    const listener = vi.fn();
    subscribe(listener);

    reportUnreachable();
    reportUnreachable();
    reportUnreachable();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keep being told when one of them throws', () => {
    // A broken banner must not stop the flusher hearing that the network is back.
    const broken = vi.fn(() => { throw new Error('render failed'); });
    const flusher = vi.fn();
    subscribe(broken);
    subscribe(flusher);

    reportUnreachable();
    expect(flusher).toHaveBeenCalledWith(false);
  });

  it('stop after unsubscribing', () => {
    const listener = vi.fn();
    subscribe(listener)();
    reportUnreachable();
    expect(listener).not.toHaveBeenCalled();
  });
});
