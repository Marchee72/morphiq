import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useStore } from '../../presentation/state/store';
import { AppDataProvider } from '../data/AppDataProvider';
import { AppActionsProvider } from '../data/AppActionsProvider';
import { SocialContext } from '../data/contexts';
import { buildBuddyRows, buildMessageDays, totalUnread } from '../derive/social';
import { AtlasBuddies } from '../atlas/AtlasBuddies';
import { testProfile, TEST_NOW } from '../../test/renderScreen';
import type { BuddyLink, BuddyMessage } from '../../core/entities/Buddy';
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
  unreadCount: 0,
  ...over,
});

const noop = async () => {};
const noop2 = async (_linkId: string, _body: string) => {};

function renderBuddies(
  links: BuddyLink[],
  { initialCode, error = null, removeBuddy = noop, messages = {}, sendMessage = noop2 }: {
    initialCode?: string;
    error?: string | null;
    removeBuddy?: (linkId: string) => Promise<void>;
    messages?: Record<string, BuddyMessage[]>;
    sendMessage?: (linkId: string, body: string) => Promise<void>;
  } = {},
) {
  useStore.setState({ activeProfile: testProfile, profiles: [testProfile] });

  const rows = buildBuddyRows(links);
  const social: SocialState = {
    available: true,
    ready: true,
    links,
    invite: null,
    error,
    rows,
    unread: totalUnread(rows),
    refresh: noop,
    createInvite: noop,
    revokeInvite: noop,
    redeemInvite: noop,
    removeBuddy,
    setBlocked: noop,
    conversation: linkId => (messages[linkId] ? buildMessageDays(messages[linkId], 'p1') : []),
    // Nothing to follow in a test: the sheet subscribes on mount and the
    // unsubscribe has to be callable or React complains on unmount.
    watchConversation: () => () => {},
    sendMessage,
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

  it('shows how many messages are waiting', async () => {
    renderBuddies([link({ unreadCount: 3 })]);
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
  });

  it('does not badge a paused partner, whose count could never be cleared', async () => {
    renderBuddies([link({ unreadCount: 3, blockedByMe: true })]);
    await waitFor(() => expect(text()).toContain('Ana'));
    expect(screen.queryByText('3')).toBeNull();
  });

  it('says the server was unreachable while keeping the list it had', async () => {
    // Blanking a list that is probably still accurate is the worse failure.
    renderBuddies([link()], { error: 'Failed to fetch' });

    await waitFor(() => expect(text()).toContain('Could not reach the server'));
    expect(text()).toContain('Ana');
  });
});

describe('the conversation', () => {
  const message = (over: Partial<BuddyMessage> = {}): BuddyMessage => ({
    id: '1',
    linkId: '1',
    senderProfileId: '9',
    kind: 'text',
    body: '¿vas a las 18?',
    createdAt: new Date(2026, 6, 27, 17, 5),
    ...over,
  });

  async function openChat(over: Parameters<typeof renderBuddies>[1] = {}) {
    renderBuddies([link()], over);
    await waitFor(() => expect(screen.getByText('Ana')).toBeTruthy());
    fireEvent.click(screen.getByText('Ana'));
    await waitFor(() => expect(screen.getByLabelText(/Write a message/i)).toBeTruthy());
  }

  it('opens from the partner row and shows the thread', async () => {
    await openChat({ messages: { '1': [message()] } });
    expect(text()).toContain('¿vas a las 18?');
  });

  it('shows the time each message landed', async () => {
    await openChat({ messages: { '1': [message()] } });
    expect(text()).toContain('17:05');
  });

  it('says what an empty conversation is for', async () => {
    await openChat();
    expect(text()).toContain('Ask Ana when they are training');
  });

  it('sends what was typed and clears the box', async () => {
    const sendMessage = vi.fn(async () => {});
    await openChat({ sendMessage });

    const input = screen.getByLabelText(/Write a message/i);
    fireEvent.change(input, { target: { value: 'a las 19 mejor' } });
    fireEvent.click(screen.getByLabelText(/^Send$/i));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('1', 'a las 19 mejor'));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
  });

  it('sends on Enter, because that is what a chat box does', async () => {
    const sendMessage = vi.fn(async () => {});
    await openChat({ sendMessage });

    const input = screen.getByLabelText(/Write a message/i);
    fireEvent.change(input, { target: { value: 'dale' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith('1', 'dale'));
  });

  it('refuses to send nothing but whitespace', async () => {
    const sendMessage = vi.fn(async () => {});
    await openChat({ sendMessage });

    fireEvent.change(screen.getByLabelText(/Write a message/i), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByLabelText(/Write a message/i), { key: 'Enter' });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('keeps your text when sending fails', async () => {
    // Retyping a message the gym's signal ate is the one thing guaranteed to
    // annoy, so the box holds it and says so.
    const sendMessage = vi.fn(async () => { throw new Error('offline'); });
    await openChat({ sendMessage });

    const input = screen.getByLabelText(/Write a message/i);
    fireEvent.change(input, { target: { value: 'nos vemos' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(text()).toContain('did not send'));
    expect((input as HTMLInputElement).value).toBe('nos vemos');
  });
});
