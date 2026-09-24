import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AtlasSyncBanner } from '../atlas/AtlasSyncBanner';
import { AtlasResumeBanner } from '../atlas/AtlasResumeBanner';
import { AtlasResumeSheet } from '../atlas/AtlasResumeSheet';
import { AppActionsProvider } from '../data/AppActionsProvider';
import { useAppActions, useAppUi } from '../data/useAppData';
import { useStore } from '../../presentation/state/store';
import { testProfile } from '../../test/renderScreen';
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
    const retry = vi.spyOn(offline, 'retryNow').mockImplementation(async () => {});

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

  it('offers a way out of a refusal, instead of a banner that never leaves', async () => {
    // Refused ops are never retried on their own, so without these two buttons
    // the banner stayed up for good, even after the server was fixed.
    const offline = await import('../../data/offline');
    const retry = vi.spyOn(offline, 'retryNow').mockImplementation(async () => {});
    const discard = vi.spyOn(offline, 'discardRefused').mockImplementation(async () => {});

    setSyncState({ online: true, failed: 3 });
    render(<AtlasSyncBanner />);

    fireEvent.click(screen.getByRole('button', { name: /Try now|Reintentar ahora/i }));
    expect(retry).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^(Discard|Descartar)$/i }));
    expect(discard).toHaveBeenCalled();
  });

  it('reports a failure ahead of a queue, because it is the worse news', () => {
    setSyncState({ online: false, pending: 5, failed: 1 });
    render(<AtlasSyncBanner />);

    expect(screen.getByText(/could not be saved|no se pudieron guardar/i)).toBeTruthy();
    expect(screen.queryByText(/5 changes waiting/i)).toBeNull();
  });
});

/**
 * The other band in that slot: the way back to a workout the resume sheet was
 * closed on.
 *
 * The sheet asks once per launch, and its X answers none of its three
 * questions — so without this the stored session is alive and unreachable until
 * the process dies. What is pinned here is that the door stays open.
 */

const STORED_SESSION = {
  profileId: 'p1',
  savedAt: new Date(2026, 6, 27, 18, 30),
  session: {
    startTime: new Date(2026, 6, 27, 17, 30),
    workoutType: 'Push A',
    routineSource: 'manual' as const,
    routineExercises: [{ id: 'e1', exerciseName: 'Barbell Bench Press', targetSets: 3 }],
    sets: [{ exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 80, reps: 8, isCompleted: true }],
  },
};

/** Banner and sheet wired the way the shell wires them: through the overlay slot. */
const ResumeHarness: React.FC = () => {
  const { overlay } = useAppUi();
  const actions = useAppActions();
  return (
    <>
      <AtlasResumeBanner />
      <AtlasResumeSheet open={overlay === 'resumeSession'} onClose={actions.closeOverlay} />
    </>
  );
};

const Resume: React.FC = () => (
  <AppActionsProvider>
    <ResumeHarness />
  </AppActionsProvider>
);

describe('AtlasResumeBanner', () => {
  const initialState = useStore.getState();

  beforeEach(() => {
    useStore.setState(initialState, true);
    useStore.setState({
      activeProfile: testProfile,
      pendingResume: STORED_SESSION,
      activeSession: null,
    });
  });

  afterEach(() => {
    useStore.setState(initialState, true);
  });

  it('says nothing when there is nothing waiting', () => {
    useStore.setState({ pendingResume: null });
    const { container } = render(<Resume />);
    expect(container.textContent).toBe('');
  });

  it('offers the interrupted session while one is stored', () => {
    render(<Resume />);
    expect(screen.getByText(/unfinished workout|sesión sin cerrar/i)).toBeTruthy();
  });

  it('stays quiet while a session is actually running', () => {
    // Offering to resume the workout you are in the middle of is not an offer.
    useStore.setState({ activeSession: STORED_SESSION.session });
    const { container } = render(<Resume />);
    expect(container.textContent).toBe('');
  });

  it('keeps a stored session belonging to someone else off screen', () => {
    useStore.setState({ pendingResume: { ...STORED_SESSION, profileId: 'p2' } });
    const { container } = render(<Resume />);
    expect(container.textContent).toBe('');
  });

  it('re-opens the sheet, with all three answers, when tapped', async () => {
    render(<Resume />);
    fireEvent.click(screen.getByText(/unfinished workout|sesión sin cerrar/i));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /resume|retomar/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /finish now|terminar ya/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /discard it|descartar/i })).toBeTruthy();
    });
  });

  it('is still there after the sheet is closed without an answer', async () => {
    render(<Resume />);
    fireEvent.click(screen.getByText(/unfinished workout|sesión sin cerrar/i));
    await waitFor(() => expect(screen.getByRole('button', { name: /close|cerrar/i })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /close|cerrar/i }));

    // The X resolves nothing, so the door has to still be there.
    await waitFor(() => expect(screen.queryByRole('button', { name: /resume|retomar/i })).toBeNull());
    expect(screen.getByText(/unfinished workout|sesión sin cerrar/i)).toBeTruthy();
  });
});
