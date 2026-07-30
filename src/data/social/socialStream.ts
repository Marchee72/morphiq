import { authHeaders, clearSession } from '../auth/session';
import { apiBaseUrl } from '../database/mode';

/**
 * One frame off the wire.
 *
 * `id` carries the cursor, so a reconnect resumes rather than replaying.
 */
export interface SocialEvent {
  event: string;
  data: unknown;
  id?: string;
}

export interface SocialTransport {
  /** Opens the connection. Call the returned function to close it. */
  open(options: {
    profileId: string;
    since: string | null;
    onEvent(event: SocialEvent): void;
    onStatus(status: 'connecting' | 'live' | 'retrying'): void;
  }): () => void;
}

/** Clean end of a stream, which the server does on purpose every few minutes. */
const RECONNECT_IMMEDIATE_MS = 50;
const BACKOFF_START_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

/** ±20%, so a hundred clients dropped by one outage do not return in lockstep. */
function jitter(ms: number): number {
  return Math.round(ms * (0.8 + Math.random() * 0.4));
}

/**
 * Server-sent events over `fetch`, not `EventSource`.
 *
 * `EventSource` cannot set an `Authorization` header, and this app authenticates
 * with a bearer token. The alternatives were putting a 30-day session token in
 * the URL — where it lands in access logs and `Referer` — or minting a
 * short-lived stream ticket, which `EventSource` would then reuse after it
 * expired because its automatic reconnect is not controllable. Reading the body
 * by hand costs about eighty lines and takes all three problems away.
 *
 * The wire format is still SSE, so `curl -N` remains a debugging tool.
 */
export const sseTransport: SocialTransport = {
  open({ profileId, since, onEvent, onStatus }) {
    let cursor = since;
    let stopped = false;
    let backoff = BACKOFF_START_MS;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (stopped) return;
      onStatus('connecting');
      controller = new AbortController();

      try {
        const query = new URLSearchParams({ profileId });
        if (cursor) query.set('since', cursor);

        const res = await fetch(`${apiBaseUrl()}/api/social/stream?${query}`, {
          headers: { ...authHeaders(), 'ngrok-skip-browser-warning': 'true' },
          signal: controller.signal,
        });

        // A dead session has to stop the loop, not retry it forever.
        if (res.status === 401) {
          clearSession();
          stopped = true;
          return;
        }
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        onStatus('live');
        backoff = BACKOFF_START_MS;

        await readFrames(res.body, frame => {
          if (frame.id) cursor = frame.id;
          onEvent(frame);
        });

        // The server ends every few minutes on purpose. Expected, not an error,
        // so it reconnects at once rather than backing off.
        if (!stopped) schedule(RECONNECT_IMMEDIATE_MS);
      } catch (err) {
        if (stopped || (err as Error).name === 'AbortError') return;
        onStatus('retrying');
        schedule(jitter(backoff));
        backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
      }
    };

    const schedule = (delay: number) => {
      if (retryTimer !== null) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => { void connect(); }, delay);
    };

    void connect();

    return () => {
      stopped = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      controller?.abort();
    };
  },
};

/**
 * Parses an SSE body into frames.
 *
 * Frames are separated by a blank line and can arrive split across chunks, so
 * the tail of a chunk has to be carried forward — reading each chunk as a whole
 * frame works right up until a message is big enough to be split, which is
 * exactly when it matters.
 */
async function readFrames(
  body: ReadableStream<Uint8Array>,
  onFrame: (frame: SocialEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;

    buffer += decoder.decode(value, { stream: true });

    let split = buffer.indexOf('\n\n');
    while (split !== -1) {
      const raw = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const frame = parseFrame(raw);
      if (frame) onFrame(frame);
      split = buffer.indexOf('\n\n');
    }
  }
}

function parseFrame(raw: string): SocialEvent | null {
  let event = 'message';
  let id: string | undefined;
  const dataLines: string[] = [];

  for (const line of raw.split('\n')) {
    // Comments are the heartbeat. They keep proxies open and carry nothing.
    if (line.startsWith(':') || line.length === 0) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('id:')) id = line.slice(3).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }

  if (dataLines.length === 0) return null;
  try {
    return { event, id, data: JSON.parse(dataLines.join('\n')) };
  } catch {
    // A frame we cannot read is not worth killing the stream over.
    return null;
  }
}
