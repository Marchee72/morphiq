import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { sseTransport, type SocialEvent } from '../socialStream';

/**
 * The frame parser, which is the subtle part.
 *
 * A stream arrives in whatever chunks the network feels like. Reading each
 * chunk as one frame works perfectly until a frame is large enough to be split,
 * which is exactly when it matters and exactly what is hard to reproduce by
 * hand. These drive the transport with chunk boundaries in deliberately awkward
 * places.
 */

/** A response body that yields exactly the chunks given, then ends. */
function bodyOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) { controller.close(); return; }
      controller.enqueue(encoder.encode(chunks[i++]));
    },
  });
}

/** Runs the transport over one canned response and collects what came out. */
function collect(chunks: string[], status = 200): Promise<SocialEvent[]> {
  const events: SocialEvent[] = [];
  return new Promise(resolve => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      body: bodyOf(chunks),
    })));

    const close = sseTransport.open({
      profileId: '1',
      since: null,
      onEvent: event => events.push(event),
      onStatus: () => {},
    });

    // The stream ends on its own once the canned chunks run out; the transport
    // then schedules a reconnect, which closing cancels.
    setTimeout(() => { close(); resolve(events); }, 30);
  });
}

beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('the frame parser', () => {
  it('reads a whole frame arriving in one chunk', async () => {
    const events = await collect(['event: message\ndata: {"id":"1"}\n\n']);
    expect(events).toEqual([{ event: 'message', id: undefined, data: { id: '1' } }]);
  });

  it('reassembles a frame split across chunks', async () => {
    // The case that works by luck until a message is long enough to be split.
    const events = await collect(['event: mess', 'age\ndata: {"id":', '"1"}\n\n']);
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({ id: '1' });
  });

  it('reads several frames arriving in one chunk', async () => {
    const events = await collect([
      'event: a\ndata: {"n":1}\n\nevent: b\ndata: {"n":2}\n\n',
    ]);
    expect(events.map(e => e.event)).toEqual(['a', 'b']);
  });

  it('keeps a partial frame for the next chunk rather than dropping it', async () => {
    const events = await collect(['event: a\ndata: {"n":1}\n\nevent: b\nda', 'ta: {"n":2}\n\n']);
    expect(events.map(e => e.event)).toEqual(['a', 'b']);
  });

  it('takes the cursor off the id line', async () => {
    const events = await collect(['id: m42.p99\nevent: message\ndata: {}\n\n']);
    expect(events[0].id).toBe('m42.p99');
  });

  it('ignores heartbeat comments', async () => {
    // They exist to keep proxies open and carry nothing.
    const events = await collect([':hb\n\nevent: a\ndata: {}\n\n:hb\n\n']);
    expect(events).toHaveLength(1);
  });

  it('skips a frame whose data will not parse, rather than dying', async () => {
    const events = await collect([
      'event: a\ndata: {oops\n\nevent: b\ndata: {"n":2}\n\n',
    ]);
    expect(events.map(e => e.event)).toEqual(['b']);
  });

  it('ignores a frame with no data line', async () => {
    const events = await collect(['event: a\n\nevent: b\ndata: {}\n\n']);
    expect(events.map(e => e.event)).toEqual(['b']);
  });

  it('yields nothing from an empty stream', async () => {
    expect(await collect([])).toEqual([]);
  });
});

describe('a rejected session', () => {
  it('stops rather than reconnecting forever', async () => {
    // Retrying a 401 is an infinite loop against a token that will not improve.
    const fetchSpy = vi.fn(async () => ({ ok: false, status: 401, body: null }));
    vi.stubGlobal('fetch', fetchSpy);

    const close = sseTransport.open({
      profileId: '1', since: null, onEvent: () => {}, onStatus: () => {},
    });
    await new Promise(resolve => setTimeout(resolve, 40));
    close();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
