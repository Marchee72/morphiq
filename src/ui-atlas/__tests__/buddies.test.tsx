import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useStore } from '../../presentation/state/store';
import { AppDataProvider } from '../data/AppDataProvider';
import { AppActionsProvider } from '../data/AppActionsProvider';
import { SocialContext } from '../data/contexts';
import { buildBuddyRows } from '../derive/social';
import { AtlasBuddies } from '../atlas/AtlasBuddies';
import { testProfile, TEST_NOW } from '../../test/renderScreen';
import type { BuddyLink } from '../../core/entities/Buddy';
import type { SocialState } from '../data/types';

/**
 * The partners hub.
 *
 * `SocialContext` is supplied directly rather than through `SocialProvider`.
 * Under test `VITE_DB_TYPE` is `local`, so the real provider correctly reports
 * itself unavailable and clears its own state — which is the right behaviour and
 * the wrong fixture. What is worth pinning here is what the screen does with a
 * list of partners; that the provider can fetch one is a different question, and
 * answering it would need a faked server.
 */

const initialStore = useStore.getState();
const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? '';

const link = (over: Partial<BuddyLink> = {}): BuddyLink => ({
  id: '1',
  myProfileId: 'p1',
  buddyProfileId: '9',
  buddyName: 'Ana',
  createdAt: new Date(2026, 5, 12),
  blockedByMe: false,
  blockedByThem: false,
  ...over,
});

const noop = async () => {};

function renderBuddies(
  links: BuddyLink[],
  { initialCode, error = null, removeBuddy = noop }: {
    initialCode?: string;
    error?: string | null;
    removeBuddy?: (linkId: string) => Promise<void>;
  } = {},
) {
  useStore.setState({ activeProfile: testProfile, profiles: [testProfile] });

  const social: SocialState = {
    available: true,
    ready: true,
    links,
    invite: null,
    error,
    rows: buildBuddyRows(links),
    refresh: noop,
    createInvite: noop,
    revokeInvite: noop,
    redeemInvite: noop,
    removeBuddy,
    setBlocked: noop,
  };

  return render(
    <AppDataProvider now={TEST_NOW}>
      <AppActionsProvider>
        <SocialContext.Provider value={social}>
          <div className="app at">
            <AtlasBuddies onClose={() => {}} initialCode={initialCode} />
          </div>
        </SocialContext.Provider>
      </AppActionsProvider>
    </AppDataProvider>,
  );
}

beforeEach(() => {
  useStore.setState(initialStore, true);
});

describe('the partners hub', () => {
  it('says whose partners these are, so a profile switch is never mysterious', async () => {
    // A friendship belongs to one profile. Switching profiles empties the list,
    // and without the name that reads as data loss.
    renderBuddies([link()]);
    await waitFor(() => expect(text()).toContain('Marche'));
  });

  it('offers both doors when there is nobody yet', async () => {
    renderBuddies([]);
    await waitFor(() => expect(screen.getAllByText(/Invite a partner/i).length).toBeGreaterThan(0));
    expect(screen.getByText(/I have a code/i)).toBeTruthy();
  });

  it('lists a partner with the date the friendship started', async () => {
    renderBuddies([link()]);
    await waitFor(() => expect(text()).toContain('Ana'));
    // Formatted at the render edge — the view model carries a Date.
    expect(text()).toContain('12/06/2026');
  });

  it('offers resume only to the side that paused', async () => {
    // The other side seeing "resume" would promise something the server refuses.
    renderBuddies([link({ blockedByMe: true })]);
    await waitFor(() => expect(screen.getByText(/Resume/i)).toBeTruthy());
    expect(screen.queryByText(/Pause this partner/i)).toBeNull();
  });

  it('offers neither pause nor resume to the side that was paused', async () => {
    renderBuddies([link({ blockedByThem: true })]);
    await waitFor(() => expect(text()).toContain('Paused'));
    expect(screen.queryByText(/Resume/i)).toBeNull();
    expect(screen.queryByText(/Pause this partner/i)).toBeNull();
  });

  it('keeps a paused partner in the list rather than hiding them', async () => {
    // Hiding them would leave no way to lift a pause you set yourself.
    renderBuddies([link({ blockedByMe: true })]);
    await waitFor(() => expect(text()).toContain('Ana'));
  });

  it('is honest that removing leaves their copy with them', async () => {
    // The confirmation used to claim the conversation went for both people.
    // It does not: your copy is deleted and theirs is not, and promising
    // otherwise is the one thing this dialog must never do.
    renderBuddies([link()]);
    await waitFor(() => expect(screen.getByText(/Remove partner/i)).toBeTruthy());

    fireEvent.click(screen.getByText(/Remove partner/i));

    await waitFor(() => expect(text()).toContain('Remove Ana?'));
    expect(text()).toContain('Their copy stays with them');
    expect(text()).not.toContain('for both of you');
  });

  it('does not remove anyone until the warning is accepted', async () => {
    const removeBuddy = vi.fn(async () => {});
    renderBuddies([link()], { removeBuddy });

    await waitFor(() => expect(screen.getByText(/Remove partner/i)).toBeTruthy());
    fireEvent.click(screen.getByText(/Remove partner/i));
    await waitFor(() => expect(text()).toContain('Remove Ana?'));

    expect(removeBuddy).not.toHaveBeenCalled();
  });

  it('removes once the warning is accepted', async () => {
    const removeBuddy = vi.fn(async () => {});
    renderBuddies([link()], { removeBuddy });

    await waitFor(() => expect(screen.getByText(/Remove partner/i)).toBeTruthy());
    fireEvent.click(screen.getByText(/Remove partner/i));
    await waitFor(() => expect(screen.getByText('Remove')).toBeTruthy());
    fireEvent.click(screen.getByText('Remove'));

    await waitFor(() => expect(removeBuddy).toHaveBeenCalledWith('1'));
  });

  it('opens straight onto redemption when a code arrived in the link', async () => {
    // Somebody following an invite link has one thing to do, and it is not
    // reading a list of people they do not have yet.
    renderBuddies([], { initialCode: 'ABCD2345' });
    await waitFor(() => expect(screen.getByDisplayValue('ABCD2345')).toBeTruthy());
  });

  it('normalises a pasted code before it is ever shown', async () => {
    renderBuddies([], { initialCode: 'abcd-2345' });
    await waitFor(() => expect(screen.getByDisplayValue('ABCD2345')).toBeTruthy());
  });

  it('says the server was unreachable while keeping the list it had', async () => {
    // Blanking a list that is probably still accurate is the worse failure.
    renderBuddies([link()], { error: 'Failed to fetch' });

    await waitFor(() => expect(text()).toContain('Could not reach the server'));
    expect(text()).toContain('Ana');
  });
});
