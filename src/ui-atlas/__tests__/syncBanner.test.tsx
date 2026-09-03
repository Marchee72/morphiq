import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AtlasSyncBanner } from '../atlas/AtlasSyncBanner';
import { resetSyncState, setSyncState } from '../../data/offline/syncState';

/**
 * What the app admits when it cannot reach the server.
 *
 * The rule this is mostly pinning is the negative one: when everything is
 * working, it says nothing at all. A permanent "you are online" strip would sit
 * on every screen forever and teach people to stop reading the top of the app —
 * which is exactly where the one message that matters would then appear.
 */

beforeEach(() => {
  resetSyncState();
});

afterEach(() => {
  resetSyncState();
  vi.restoreAllMocks();
});

describe('AtlasSyncBanner', () => {
  it('says nothing when everything is working', () => {
    const { container } = render(<AtlasSyncBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('says so when there is no connection', () => {
    setSyncState({ online: false });
    render(<AtlasSyncBanner />);

    expect(screen.getByText(/Offline|Sin conexion/i)).toBeTruthy();
    // The reassurance is the important half: the workout is not lost.
    expect(screen.getByText(/saved on this device|guarda en este dispositivo/i)).toBeTruthy();
  });

  it('counts what is waiting, with the right plural', () => {
    setSyncState({ online: false, pending: 1 });
    const { rerender } = render(<AtlasSyncBanner />);
    expect(screen.getByText(/1 change waiting/i)).toBeTruthy();

    setSyncState({ pending: 13 });
    rerender(<AtlasSyncBanner />);
    expect(screen.getByText(/13 changes waiting/i)).toBeTruthy();
  });

  it('shows progress while the queue is draining', () => {
    setSyncState({ online: true, pending: 4, flushing: true });
    render(<AtlasSyncBanner />);
    expect(screen.getByText(/Syncing|Sincronizando/i)).toBeTruthy();
  });

  it('offers a retry only when one would do something', () => {
    // Mid-drain, or with no network, the button could only be a lie.
    setSyncState({ online: true, pending: 4, flushing: true });
    const { rerender } = render(<AtlasSyncBanner />);
    expect(screen.queryByRole('button', { name: /Try now|Reintentar ahora/i })).toBeNull();

    setSyncState({ flushing: false });
    rerender(<AtlasSyncBanner />);
    expect(screen.getByRole('button', { name: /Try now|Reintentar ahora/i })).toBeTruthy();
  });

  it('drains on demand when asked', async () => {
    const offline = await import('../../data/offline');
    const retry = vi.spyOn(offline, 'retryNow').mockImplementation(() => {});

    setSyncState({ online: true, pending: 2, flushing: false });
    render(<AtlasSyncBanner />);
    fireEvent.click(screen.getByRole('button', { name: /Try now|Reintentar ahora/i }));

    expect(retry).toHaveBeenCalled();
  });

  it('admits it when something of the user\'s did not make it', () => {
    // Silently dropping a workout is the one outcome the whole offline layer
    // exists to prevent; this is where it stops being silent.
    setSyncState({ online: true, failed: 2 });
    render(<AtlasSyncBanner />);

    expect(screen.getByText(/could not be saved|no se pudieron guardar/i)).toBeTruthy();
    expect(screen.getByText(/refused 2|rechazo 2/i)).toBeTruthy();
  });

  it('reports a failure ahead of a queue, because it is the worse news', () => {
    setSyncState({ online: false, pending: 5, failed: 1 });
    render(<AtlasSyncBanner />);

    expect(screen.getByText(/could not be saved|no se pudieron guardar/i)).toBeTruthy();
    expect(screen.queryByText(/5 changes waiting/i)).toBeNull();
  });
});
