import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Launching with no network at all.
 *
 * The whole point of the feature, and the one path where getting it wrong is
 * loud: `loadProfiles` marks itself loaded even when its read throws, and an
 * empty `profiles` reads as "new user". So an offline launch that does not
 * serve cached profiles lands the user on the sign-up form — a form whose every
 * field fails to save, in front of someone who has been using the app for
 * months.
 *
 * Server mode, because that is the only mode with a gate. `vite.config.ts`
 * forces local for the suite, so the whole module graph is rebuilt against a
 * stubbed env — the idiom `authGate.test.ts` established.
 */

const ALICE = { id: 1, email: 'alice@example.test', name: 'Alice', picture: null };
const BOB = { id: 2, email: 'bob@example.test', name: 'Bob', picture: null };

const PROFILE = {
  id: '1', name: 'Alex', gender: 'male', height: 180,
  birthDate: new Date('1995-01-01'), createdAt: new Date('2026-01-01'),
};

/**
 * A server-mode app with a completely dead network and, optionally, a snapshot.
 *
 * Every request throws, which is what a phone in a basement actually sees —
 * including the gate probe, so this exercises the real decision rather than a
 * stubbed one.
 */
async function launchOffline(opts: { cached: boolean; signedInAs?: typeof ALICE }) {
  vi.resetModules();
  vi.stubEnv('VITE_DB_TYPE', 'server');
  vi.stubEnv('VITE_API_URL', 'https://example.test');
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

  const [session, marker, snapshot, dbMod, types] = await Promise.all([
    import('./data/auth/session'),
    import('./data/offline/snapshotMarker'),
    import('./data/offline/snapshot'),
    import('./data/offline/offlineDb'),
    import('./data/offline/types'),
  ]);

  const db = dbMod.offlineDb();
  for (const table of [db.rows, db.ops, db.ids, db.meta]) await table.clear();
  marker.clearMarker();

  if (opts.cached) {
    // Filled the way the app fills it: by a successful read, back when there
    // was a network. `cacheRows` stamps it with whoever is signed in.
    session.setSession({ token: 'good', user: ALICE });
    await snapshot.cacheRows(
      'profile', types.PROFILE_PARTITION,
      [PROFILE as unknown as Record<string, unknown>], 'replace',
    );
  }

  session.setSession({ token: 'good', user: opts.signedInAs ?? ALICE });

  const { default: App } = await import('./App');
  return render(<App />);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('launching offline', () => {
  it('opens the app on the cached snapshot rather than a wall', async () => {
    await launchOffline({ cached: true });

    await screen.findByRole('button', { name: 'Today' }, { timeout: 10_000 });
    expect(screen.queryByText(/cannot reach the server/i)).not.toBeInTheDocument();
  });

  it('never shows the sign-up form to someone who already has a profile', async () => {
    /**
     * The trap. `loadProfiles` sets `profilesLoaded: true` inside its catch, and
     * the branch below it reads `profiles.length === 0` as a new user. Without
     * cached profiles this is the screen an offline launch produces.
     */
    await launchOffline({ cached: true });

    await screen.findByRole('button', { name: 'Today' }, { timeout: 10_000 });
    expect(screen.queryByRole('button', { name: /create profile/i })).not.toBeInTheDocument();
  });

  it('shows the wall when there is nothing cached to show', async () => {
    // A fresh install that has never reached the server. An empty app would be
    // worse than admitting the server cannot be reached.
    await launchOffline({ cached: false });

    await screen.findByText(/cannot reach the server/i, undefined, { timeout: 10_000 });
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  });

  it('shows the wall rather than the previous account\'s data on a shared phone', async () => {
    /**
     * Alice's snapshot is still in this browser's IndexedDB when Bob signs in.
     * The account stamp is the only thing standing between him and her training
     * history, and this is the test that says so.
     */
    await launchOffline({ cached: true, signedInAs: BOB });

    await screen.findByText(/cannot reach the server/i, undefined, { timeout: 10_000 });
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();
  });
});
