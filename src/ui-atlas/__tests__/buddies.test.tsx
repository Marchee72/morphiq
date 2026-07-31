import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useStore } from '../../presentation/state/store';
import { AppDataProvider } from '../data/AppDataProvider';
import { AppActionsProvider } from '../data/AppActionsProvider';
import { SocialContext } from '../data/contexts';
import {
  buildBuddyRows, buildMessageDays, buildPresenceRows, buildSharedRows, totalUnread,
} from '../derive/social';
import { AtlasBuddies } from '../atlas/AtlasBuddies';
import { AtlasSharedStrip } from '../atlas/AtlasSharedStrip';
import { testProfile, TEST_NOW } from '../../test/renderScreen';
import type {
  BuddyLink, BuddyMessage, BuddyPresence, SharedRoutine, SharedSession,
} from '../../core/entities/Buddy';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';
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
const noopRoutine = async (_linkId: string, _routine: SharedRoutine) => {};

function renderBuddies(
  links: BuddyLink[],
  {
    initialCode, error = null, removeBuddy = noop, messages = {},
    sendMessage = noop2, presence = [], shared = null,
    startShared = noop, joinShared = noop, shareRoutine = noopRoutine,
    routines = [],
  }: {
    initialCode?: string;
    error?: string | null;
    removeBuddy?: (linkId: string) => Promise<void>;
    messages?: Record<string, BuddyMessage[]>;
    sendMessage?: (linkId: string, body: string) => Promise<void>;
    presence?: BuddyPresence[];
    shared?: SharedSession | null;
    startShared?: (linkId: string) => Promise<void>;
    joinShared?: (sessionId: string) => Promise<void>;
    shareRoutine?: (linkId: string, routine: SharedRoutine) => Promise<void>;
    routines?: RoutineTemplate[];
  } = {},
) {
  useStore.setState({
    activeProfile: testProfile,
    profiles: [testProfile],
    savedRoutines: routines,
    // `AppDataProvider` reloads routines on mount, which under test means
    // fetching from an empty local database and clearing what was just set.
    loadSavedRoutines: async () => {},
    buddiesFocus: initialCode ? { code: initialCode } : null,
  });

  const rows = buildBuddyRows(links);
  const social: SocialState = {
    available: true,
    ready: true,
    links,
    invite: null,
    error,
    rows,
    unread: totalUnread(rows),
    training: buildPresenceRows(presence, rows, 0),
    shared,
    sharedPartners: buildSharedRows(buildPresenceRows(presence, rows, 0), shared?.id ?? null),
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
    shareRoutine,
    startShared,
    joinShared,
    leaveShared: noop,
  };

  return render(
    <AppDataProvider now={TEST_NOW}>
      <AppActionsProvider>
        <SocialContext.Provider value={social}>
          <div className="app at">
            <AtlasBuddies />
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

  /**
   * Training together, from the conversation it is arranged in.
   *
   * The invitation is an ordinary message, which is what lets it use the
   * stream, the badge and the transcript the thread already has. The cost is
   * that old invitations stay in the thread forever, so most of what matters
   * here is telling a live one from a record of last Tuesday.
   */
  describe('training together', () => {
    const invitation = (over: Partial<BuddyMessage> = {}): BuddyMessage => message({
      kind: 'sessionInvite',
      body: undefined,
      payload: { sharedSessionId: '12' },
      ...over,
    });

    const session = (over: Partial<SharedSession> = {}): SharedSession => ({
      id: '12',
      linkId: '1',
      createdAt: new Date(2026, 6, 27, 17),
      startedByMe: true,
      profileIds: ['p1', '9'],
      ...over,
    });

    it('offers to train together, and says each of you does your own workout', async () => {
      await openChat();
      expect(text()).toContain('Train together');
      expect(text()).toContain('your own weights');
    });

    it('opens a container on the friendship it was asked from', async () => {
      const startShared = vi.fn(async () => {});
      await openChat({ startShared });

      fireEvent.click(screen.getByText('Train together'));

      await waitFor(() => expect(startShared).toHaveBeenCalledWith('1'));
    });

    it('stops offering once you are already in one', async () => {
      // Two containers between the same two people is the failure the whole
      // feature exists to avoid, and the tidiest place to prevent it is here.
      await openChat({ shared: session() });
      expect(text()).not.toContain('Train together');
    });

    it('shows an invitation in the thread and offers to join it', async () => {
      const joinShared = vi.fn(async () => {});
      await openChat({ messages: { '1': [invitation()] }, joinShared });

      expect(text()).toContain('Ana asked you to train together');
      fireEvent.click(screen.getByText('Join'));

      await waitFor(() => expect(joinShared).toHaveBeenCalledWith('12'));
    });

    it('says which way round the invitation went', async () => {
      await openChat({ messages: { '1': [invitation({ senderProfileId: 'p1' })] } });
      expect(text()).toContain('You asked Ana to train together');
    });

    it('reports being in the session rather than offering to join it again', async () => {
      await openChat({ messages: { '1': [invitation()] }, shared: session() });
      expect(text()).toContain('You are in this session');
      expect(screen.queryByText('Join')).toBeNull();
    });

    it('does not offer to join an old invitation while you are in another session', async () => {
      // Invitations outlive their sessions, so a thread accumulates doors that
      // no longer open onto anything.
      await openChat({
        messages: { '1': [invitation({ payload: { sharedSessionId: '11' } })] },
        shared: session({ id: '12' }),
      });
      expect(screen.queryByText('Join')).toBeNull();
    });

    it('says the session is over when joining one that has ended', async () => {
      const joinShared = vi.fn(async () => { throw new Error('gone'); });
      await openChat({ messages: { '1': [invitation()] }, joinShared });

      fireEvent.click(screen.getByText('Join'));

      await waitFor(() => expect(text()).toContain('This session is over'));
    });
  });

  /**
   * Sharing a routine.
   *
   * A copy, not a link. Most of what matters here is that the wording never
   * suggests otherwise and that nothing identifying the sender's row travels
   * with it.
   */
  describe('sharing a routine', () => {
    const routine = (over: Partial<RoutineTemplate> = {}): RoutineTemplate => ({
      id: 'r1',
      profileId: 'p1',
      title: 'Push A',
      description: 'Chest and shoulders',
      targetMuscles: ['chest'],
      exercises: [
        { exerciseId: '0025', exerciseName: 'Barbell Bench Press', targetSets: 4, targetReps: 8 },
      ],
      createdAt: new Date(2026, 5, 1),
      ...over,
    });

    const shared = (over: Partial<BuddyMessage> = {}): BuddyMessage => message({
      kind: 'routine',
      body: undefined,
      payload: {
        title: 'Push A',
        description: 'Chest and shoulders',
        targetMuscles: ['chest'],
        exercises: [
          { exerciseId: '0025', exerciseName: 'Barbell Bench Press', targetSets: 4, targetReps: 8 },
        ],
      },
      ...over,
    });

    it('says a shared routine becomes a copy of their own', async () => {
      await openChat();
      expect(text()).toContain('Share a routine');
      expect(text()).toContain('copy of their own');
    });

    it('says so plainly when you have no routine to share', async () => {
      await openChat();
      fireEvent.click(screen.getByText('Share a routine'));
      expect(text()).toContain('have not saved a routine yet');
    });

    it('sends the chosen routine without the ids that would tie it to your row', async () => {
      // `id` would aim the receiver's save at a row that is not theirs, and
      // `profileId` would file their copy under you.
      const shareRoutine = vi.fn(async () => {});
      await openChat({ routines: [routine()], shareRoutine });

      fireEvent.click(screen.getByText('Share a routine'));
      fireEvent.click(screen.getByText('Push A'));

      await waitFor(() => expect(shareRoutine).toHaveBeenCalled());
      const [linkId, sent] = shareRoutine.mock.calls[0] as unknown as [string, SharedRoutine];
      expect(linkId).toBe('1');
      expect(sent).not.toHaveProperty('id');
      expect(sent).not.toHaveProperty('profileId');
      expect(sent.title).toBe('Push A');
    });

    it('shows a received routine with its title and how big it is', async () => {
      await openChat({ messages: { '1': [shared()] } });
      expect(text()).toContain('Ana shared a routine');
      expect(text()).toContain('Push A');
      expect(text()).toContain('1 exercise');
    });

    it('calls the button what it does, which is take a copy', async () => {
      // Anything friendlier would suggest a live link that later edits follow,
      // and there is no such link.
      await openChat({ messages: { '1': [shared()] } });
      expect(screen.getByText('Save a copy')).toBeTruthy();
    });

    it('saves under your own profile, with no id from the sender', async () => {
      type Draft = Omit<RoutineTemplate, 'profileId' | 'createdAt'>;
      const save = vi.fn(async (_draft: Draft) => 'r9');
      await openChat({ messages: { '1': [shared()] } });
      // Set after `openChat`, which owns store state and would overwrite it.
      useStore.setState({ saveRoutineTemplate: save });

      fireEvent.click(screen.getByText('Save a copy'));

      await waitFor(() => expect(save).toHaveBeenCalled());
      const saved = save.mock.calls[0][0];
      expect(saved).not.toHaveProperty('id');
      expect(saved).not.toHaveProperty('profileId');
      expect(saved.title).toBe('Push A');
      await waitFor(() => expect(text()).toContain('Saved to your routines'));
    });

    it('does not offer to copy a routine you shared yourself', async () => {
      await openChat({ messages: { '1': [shared({ senderProfileId: 'p1' })] } });
      expect(text()).toContain('You shared a routine');
      expect(screen.queryByText('Save a copy')).toBeNull();
    });

    it('says a routine did not come through rather than offering an empty copy', async () => {
      // Messages outlive the shape they were written in, so a payload from an
      // older app has to render as something other than a button saving nothing.
      await openChat({ messages: { '1': [shared({ payload: { title: 'Push A' } })] } });

      expect(text()).toContain('did not come through');
      expect(screen.queryByText('Save a copy')).toBeNull();
    });
  });
});

/**
 * The participant strip, which sits under the Train header during a workout.
 *
 * Rendered on its own rather than through the screen: what is worth pinning is
 * that it shows the room and nothing but the room, and reaching it through
 * `AtlasTrain` would mean standing up a whole live session to look at two lines.
 */
describe('the shared session strip', () => {
  const presence = (over: Partial<BuddyPresence> = {}): BuddyPresence => ({
    profileId: '9',
    linkId: '1',
    sessionKey: 'k1',
    startedAt: new Date(TEST_NOW.getTime() - 20 * 60_000),
    exerciseName: 'Press banca',
    exerciseIndex: 2,
    exerciseCount: 5,
    setNumber: 2,
    setCount: 4,
    setsDone: 5,
    setsPlanned: 18,
    sharedSessionId: '12',
    updatedAt: TEST_NOW,
    ...over,
  });

  const session: SharedSession = {
    id: '12',
    linkId: '1',
    createdAt: TEST_NOW,
    startedByMe: false,
    profileIds: ['p1', '9'],
  };

  function renderStrip(
    shared: SharedSession | null,
    entries: BuddyPresence[] = [],
    leaveShared: () => Promise<void> = noop,
  ) {
    const rows = buildBuddyRows([link()]);
    const training = buildPresenceRows(entries, rows, 0);
    const social: SocialState = {
      available: true, ready: true, links: [link()], invite: null, error: null,
      rows, unread: 0, training, shared,
      sharedPartners: buildSharedRows(training, shared?.id ?? null),
      refresh: noop, createInvite: noop, revokeInvite: noop, redeemInvite: noop,
      removeBuddy: noop, setBlocked: noop,
      conversation: () => [], watchConversation: () => () => {}, sendMessage: noop2,
      shareRoutine: noopRoutine,
      startShared: noop, joinShared: noop, leaveShared,
    };

    return render(
      <SocialContext.Provider value={social}>
        <AtlasSharedStrip />
      </SocialContext.Provider>,
    );
  }

  it('renders nothing at all when you are training alone', () => {
    // It sits above the wheels on the busiest screen in the app; an empty state
    // there would cost every solo workout a permanent strip of nothing.
    const { container } = renderStrip(null, [presence()]);
    expect(container.innerHTML).toBe('');
  });

  it('shows each partner, the exercise and where they are in it', () => {
    renderStrip(session, [presence()]);
    expect(text()).toContain('Ana');
    expect(text()).toContain('Press banca, set 2 of 4');
  });

  it('never shows a weight or a rep', () => {
    // Guaranteed by the table having no column for either, and again by the
    // serialiser naming its fields. This is the last place it would show.
    renderStrip(session, [presence()]);
    expect(text()).not.toMatch(/\d+(\.\d+)?\s?kg/i);
    expect(text()).not.toMatch(/\breps?\b/i);
  });

  it('says it is waiting while nobody has joined yet', () => {
    // The container opens before anybody accepts, and those seconds are exactly
    // when you would wonder whether it worked.
    renderStrip(session, []);
    expect(text()).toContain('Waiting for someone to start');
  });

  it('lets you step out without ending your workout', () => {
    const leaveShared = vi.fn(async () => {});
    renderStrip(session, [presence()], leaveShared);

    // By role and visible text: the button's own label is its accessible name,
    // so an `aria-label` repeating it would only be one more thing to keep in step.
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));

    expect(leaveShared).toHaveBeenCalled();
  });
});
