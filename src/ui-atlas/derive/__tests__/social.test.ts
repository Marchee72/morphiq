import { describe, expect, it } from 'vitest';
import type {
  BuddyInvite, BuddyLink, BuddyMessage, BuddyPresence,
} from '../../../core/entities/Buddy';
import {
  buildBuddyRows, buildMessageDays, buildPresenceRows, buildSharedRows, inviteHoursLeft,
  isCompleteCode, isInviteLive, normalizeInviteCode, parseSharedRoutine, totalUnread,
} from '../social';

const NOW = new Date(2026, 6, 27, 18); // Monday 27 July 2026, evening
const HOUR = 3600_000;

const link = (over: Partial<BuddyLink> = {}): BuddyLink => ({
  id: '1',
  myProfileId: '1',
  buddyProfileId: '9',
  buddyName: 'Ana',
  createdAt: NOW,
  blockedByMe: false,
  blockedByThem: false,
  unreadCount: 0,
  ...over,
});

const invite = (expiresAt: Date): BuddyInvite => ({
  code: 'ABCD2345',
  createdAt: NOW,
  expiresAt,
});

describe('buildBuddyRows', () => {
  it('sorts partners by name', () => {
    const rows = buildBuddyRows([
      link({ id: '1', buddyName: 'Sofía' }),
      link({ id: '2', buddyName: 'Ana' }),
    ]);
    expect(rows.map(r => r.name)).toEqual(['Ana', 'Sofía']);
  });

  it('sinks a blocked partner below the active ones without hiding them', () => {
    // Hiding them would leave no way to lift a block you set.
    const rows = buildBuddyRows([
      link({ id: '1', buddyName: 'Ana', blockedByMe: true }),
      link({ id: '2', buddyName: 'Sofía' }),
    ]);
    expect(rows.map(r => r.name)).toEqual(['Sofía', 'Ana']);
  });

  it('treats being blocked and having blocked as equally muted', () => {
    const [mine, theirs] = buildBuddyRows([
      link({ id: '1', buddyName: 'Ana', blockedByMe: true }),
      link({ id: '2', buddyName: 'Sofía', blockedByThem: true }),
    ]);
    expect(mine.muted).toBe(true);
    expect(theirs.muted).toBe(true);
    // But which side blocked still shows, because only one of them may unblock.
    expect(mine.blockedByMe).toBe(true);
    expect(theirs.blockedByMe).toBe(false);
  });

  it('keeps a nameless partner in the list', () => {
    // A profile with no name still has to be tappable, or the friendship becomes
    // impossible to remove.
    const [row] = buildBuddyRows([link({ buddyName: '   ' })]);
    expect(row.name).toBe('');
    expect(row.linkId).toBe('1');
  });

  it('holds dates, not formatted text', () => {
    const [row] = buildBuddyRows([link()]);
    expect(row.since).toBeInstanceOf(Date);
  });
});

describe('totalUnread', () => {
  it('adds up what is waiting across conversations', () => {
    const rows = buildBuddyRows([
      link({ id: '1', buddyName: 'Ana', unreadCount: 2 }),
      link({ id: '2', buddyName: 'Sofía', unreadCount: 3 }),
    ]);
    expect(totalUnread(rows)).toBe(5);
  });

  it('ignores a paused conversation, whose badge could never be cleared', () => {
    // Nothing arrives through a paused link, so counting it would leave a badge
    // with no way to open what it points at.
    const rows = buildBuddyRows([link({ unreadCount: 4, blockedByMe: true })]);
    expect(totalUnread(rows)).toBe(0);
  });
});

describe('buildPresenceRows', () => {
  const presence = (over: Partial<BuddyPresence> = {}): BuddyPresence => ({
    profileId: '9',
    linkId: '1',
    sessionKey: 'k1',
    startedAt: new Date(NOW.getTime() - 20 * 60_000),
    exerciseName: 'Press banca',
    exerciseIndex: 2,
    exerciseCount: 5,
    setNumber: 2,
    setCount: 4,
    setsDone: 5,
    setsPlanned: 18,
    updatedAt: NOW,
    ...over,
  });

  it('names the partner from the friendship, not from the presence row', () => {
    // Presence carries a profile id and nothing else, deliberately: identity
    // comes only from a friendship you already have.
    const [row] = buildPresenceRows([presence()], buildBuddyRows([link()]), 0);
    expect(row.name).toBe('Ana');
    expect(row.exerciseName).toBe('Press banca');
  });

  it('drops presence from somebody who is not a live partner', () => {
    // Should be unreachable — the server joins on the link. If it happens
    // anyway, an unnamed stranger training is worse than showing nobody.
    expect(buildPresenceRows([presence({ profileId: '404' })], buildBuddyRows([link()]), 0))
      .toEqual([]);
  });

  it('drops presence from a paused partner', () => {
    const rows = buildBuddyRows([link({ blockedByMe: true })]);
    expect(buildPresenceRows([presence()], rows, 0)).toEqual([]);
  });

  it('shifts the start time by the clock difference', () => {
    // Their `startedAt` is off their phone's clock. Expressed in ours, or the
    // elapsed counter subtracts two different clocks from each other.
    const [row] = buildPresenceRows([presence()], buildBuddyRows([link()]), 60_000);
    expect(row.startedAt.getTime()).toBe(presence().startedAt.getTime() + 60_000);
  });

  it('puts the most recently started session first', () => {
    const rows = buildBuddyRows([
      link({ id: '1', buddyProfileId: '9', buddyName: 'Ana' }),
      link({ id: '2', buddyProfileId: '8', buddyName: 'Sofía' }),
    ]);
    const ordered = buildPresenceRows([
      presence({ profileId: '9', linkId: '1', startedAt: new Date(NOW.getTime() - 40 * 60_000) }),
      presence({ profileId: '8', linkId: '2', startedAt: new Date(NOW.getTime() - 5 * 60_000) }),
    ], rows, 0);

    expect(ordered.map(r => r.name)).toEqual(['Sofía', 'Ana']);
  });

  it('carries no weight or reps, whatever the server sent', () => {
    // The guarantee lives in the table and the serialiser; this pins that the
    // view model never grows a field to hold one either.
    const [row] = buildPresenceRows([presence()], buildBuddyRows([link()]), 0);
    expect(Object.keys(row).sort()).toEqual([
      'exerciseCount', 'exerciseIndex', 'exerciseName', 'linkId', 'name',
      'picture', 'profileId', 'setCount', 'setNumber', 'sharedSessionId', 'startedAt',
    ]);
  });

  it('survives nobody training', () => {
    expect(buildPresenceRows([], buildBuddyRows([link()]), 0)).toEqual([]);
  });
});

describe('buildSharedRows', () => {
  const rows = buildBuddyRows([
    link({ id: '1', buddyProfileId: '9', buddyName: 'Ana' }),
    link({ id: '2', buddyProfileId: '8', buddyName: 'Sofía' }),
  ]);

  const presence = (over: Partial<BuddyPresence>): BuddyPresence => ({
    profileId: '9',
    linkId: '1',
    sessionKey: 'k1',
    startedAt: NOW,
    setsDone: 0,
    setsPlanned: 0,
    updatedAt: NOW,
    ...over,
  });

  const training = (entries: BuddyPresence[]) => buildPresenceRows(entries, rows, 0);

  it('keeps only the partners in the same container', () => {
    const live = training([
      presence({ profileId: '9', linkId: '1', sharedSessionId: '12' }),
      presence({ profileId: '8', linkId: '2', sharedSessionId: '13' }),
    ]);
    expect(buildSharedRows(live, '12').map(r => r.name)).toEqual(['Ana']);
  });

  it('leaves out a partner training alone', () => {
    // Being your partner and being in the room with you are different things,
    // and the strip is about the room.
    const live = training([presence({ profileId: '9', linkId: '1' })]);
    expect(buildSharedRows(live, '12')).toEqual([]);
  });

  it('shows nobody when you are not in a container yourself', () => {
    const live = training([presence({ profileId: '9', linkId: '1', sharedSessionId: '12' })]);
    expect(buildSharedRows(live, null)).toEqual([]);
  });

  it('orders by who arrived first, so the strip does not reshuffle under a thumb', () => {
    // `buildPresenceRows` sorts newest first, which is right for Today and
    // wrong here: this one sits under your hands for an hour.
    const live = training([
      presence({
        profileId: '9', linkId: '1', sharedSessionId: '12',
        startedAt: new Date(NOW.getTime() - 40 * 60_000),
      }),
      presence({
        profileId: '8', linkId: '2', sharedSessionId: '12',
        startedAt: new Date(NOW.getTime() - 5 * 60_000),
      }),
    ]);
    expect(buildSharedRows(live, '12').map(r => r.name)).toEqual(['Ana', 'Sofía']);
  });

  it('carries nothing a presence row did not already carry', () => {
    // The whole design of shared sessions: a filter over rows you could already
    // see. If this ever grows a field of its own, that claim has stopped being
    // true.
    const entry = presence({ profileId: '9', linkId: '1', sharedSessionId: '12' });
    const live = training([entry]);
    expect(buildSharedRows(live, '12')).toEqual(live);
  });
});

describe('buildMessageDays', () => {
  const at = (day: number, hour: number) => new Date(2026, 6, day, hour);

  const message = (over: Partial<BuddyMessage> = {}): BuddyMessage => ({
    id: '1',
    linkId: '1',
    senderProfileId: '9',
    kind: 'text',
    body: 'a las 18?',
    createdAt: at(27, 10),
    ...over,
  });

  it('puts one day header over the messages of that day', () => {
    const days = buildMessageDays([
      message({ id: '1', createdAt: at(26, 20) }),
      message({ id: '2', createdAt: at(27, 9) }),
      message({ id: '3', createdAt: at(27, 19) }),
    ], '1');

    expect(days).toHaveLength(2);
    expect(days[1].messages.map(m => m.id)).toEqual(['2', '3']);
  });

  it('groups by calendar day, not by elapsed hours', () => {
    // Two messages four hours apart across midnight are two days, which is the
    // case that is wrong at exactly one moment and right the rest of the time.
    const days = buildMessageDays([
      message({ id: '1', createdAt: at(26, 23) }),
      message({ id: '2', createdAt: at(27, 3) }),
    ], '1');

    expect(days).toHaveLength(2);
  });

  it('decides which side a bubble sits on from the sender', () => {
    // The same conversation renders mirrored on the other person's phone, so
    // this cannot be baked into the message.
    const [day] = buildMessageDays([
      message({ id: '1', senderProfileId: '1' }),
      message({ id: '2', senderProfileId: '9' }),
    ], '1');

    expect(day.messages.map(m => m.mine)).toEqual([true, false]);
  });

  it('compares sender ids as strings, so a numeric id is not a different person', () => {
    const [day] = buildMessageDays([message({ senderProfileId: 1 as unknown as string })], '1');
    expect(day.messages[0].mine).toBe(true);
  });

  it('leaves out a text message with nothing in it', () => {
    const days = buildMessageDays([
      message({ id: '1', body: undefined }),
      message({ id: '2' }),
    ], '1');

    expect(days[0].messages.map(m => m.id)).toEqual(['2']);
  });

  it('keeps an invitation, and points it at the session it opened', () => {
    // The invitation is an ordinary message so it rides the machinery that
    // already delivers messages. The thread has to be able to tell it from a
    // bubble, which is why `kind` is carried rather than guessed from the
    // fields that happen to be present.
    const [day] = buildMessageDays([
      message({
        id: '1', kind: 'sessionInvite', body: undefined,
        payload: { sharedSessionId: '12' },
      }),
    ], '1');

    expect(day.messages[0].kind).toBe('sessionInvite');
    expect(day.messages[0].sharedSessionId).toBe('12');
    expect(day.messages[0].body).toBeUndefined();
  });

  it('keeps a shared routine, unpacked enough to draw', () => {
    const [day] = buildMessageDays([
      message({
        id: '1', kind: 'routine', body: undefined,
        payload: {
          title: 'Push A',
          description: '',
          targetMuscles: ['chest'],
          exercises: [{ exerciseId: '0025', exerciseName: 'Press banca', targetSets: 4 }],
        },
      }),
    ], '1');

    expect(day.messages[0].routine?.title).toBe('Push A');
    expect(day.messages[0].routine?.exercises).toHaveLength(1);
  });

  it('keeps an invitation whose payload arrived malformed', () => {
    // Dropping it would leave a gap in the thread where an event happened. It
    // renders as a record of one, without a button that could go nowhere.
    const [day] = buildMessageDays([
      message({ id: '1', kind: 'sessionInvite', body: undefined, payload: undefined }),
    ], '1');

    expect(day.messages[0].sharedSessionId).toBeUndefined();
  });

  it('holds dates, not formatted times', () => {
    const [day] = buildMessageDays([message()], '1');
    expect(day.day).toBeInstanceOf(Date);
    expect(day.messages[0].at).toBeInstanceOf(Date);
  });

  it('survives an empty conversation', () => {
    expect(buildMessageDays([], '1')).toEqual([]);
  });
});

describe('parseSharedRoutine', () => {
  const routine = {
    title: 'Push A',
    description: 'Chest and shoulders',
    targetMuscles: ['chest'],
    exercises: [{ exerciseId: '0025', exerciseName: 'Press banca', targetSets: 4, targetReps: 8 }],
  };

  it('reads back a routine the server wrote', () => {
    expect(parseSharedRoutine(routine)).toEqual(routine);
  });

  it('refuses a routine with nothing to do in it', () => {
    // The server refuses to store one, so this is about payloads written by an
    // older shape of the app — a card with no exercises and a button that would
    // save nothing is worse than saying it did not come through.
    expect(parseSharedRoutine({ ...routine, exercises: [] })).toBeUndefined();
    expect(parseSharedRoutine({ ...routine, exercises: undefined })).toBeUndefined();
  });

  it('refuses anything that is not a routine at all', () => {
    expect(parseSharedRoutine(null)).toBeUndefined();
    expect(parseSharedRoutine('Push A')).toBeUndefined();
    expect(parseSharedRoutine(undefined)).toBeUndefined();
  });

  it('drops an exercise with no name rather than the whole routine', () => {
    const parsed = parseSharedRoutine({
      ...routine,
      exercises: [{ exerciseId: '1' }, ...routine.exercises],
    });
    expect(parsed?.exercises).toHaveLength(1);
  });

  it('fills in the text a payload arrived without', () => {
    const parsed = parseSharedRoutine({ exercises: routine.exercises });
    expect(parsed?.title).toBe('');
    expect(parsed?.targetMuscles).toEqual([]);
  });
});

describe('isInviteLive', () => {
  it('is false with no invitation at all', () => {
    expect(isInviteLive(null, NOW)).toBe(false);
  });

  it('is false once the code has expired', () => {
    // The server refuses it anyway; this stops the screen offering a code it
    // already knows is dead.
    expect(isInviteLive(invite(new Date(NOW.getTime() - HOUR)), NOW)).toBe(false);
  });

  it('is true while there is time left', () => {
    expect(isInviteLive(invite(new Date(NOW.getTime() + HOUR)), NOW)).toBe(true);
  });
});

describe('inviteHoursLeft', () => {
  it('rounds up, so a code with minutes left does not read as zero', () => {
    expect(inviteHoursLeft(invite(new Date(NOW.getTime() + HOUR / 2)), NOW)).toBe(1);
  });

  it('never goes negative', () => {
    expect(inviteHoursLeft(invite(new Date(NOW.getTime() - 5 * HOUR)), NOW)).toBe(0);
  });

  it('reports a fresh code as its full life', () => {
    expect(inviteHoursLeft(invite(new Date(NOW.getTime() + 72 * HOUR)), NOW)).toBe(72);
  });
});

describe('normalizeInviteCode', () => {
  it('uppercases what was typed in lower case', () => {
    expect(normalizeInviteCode('abcd2345')).toBe('ABCD2345');
  });

  it('drops the spaces and dashes that come with a pasted code', () => {
    expect(normalizeInviteCode('ABCD-2345')).toBe('ABCD2345');
    expect(normalizeInviteCode(' ABCD 2345 ')).toBe('ABCD2345');
  });

  it('drops the characters the alphabet leaves out', () => {
    // Both halves of each confusable pair are excluded, not just one: 0/O and
    // 1/I/L are the characters people get wrong reading a code off a screenshot,
    // so the server mints none of them and typing one here means a slip.
    expect(normalizeInviteCode('0O1IL')).toBe('');
    expect(normalizeInviteCode('AB0CD1EF')).toBe('ABCDEF');
  });

  it('stops at a full code, so a double paste does not become nonsense', () => {
    expect(normalizeInviteCode('ABCD2345ABCD2345')).toBe('ABCD2345');
  });

  it('survives an empty input', () => {
    expect(normalizeInviteCode('')).toBe('');
  });
});

describe('isCompleteCode', () => {
  it('is false while the code is still being typed', () => {
    expect(isCompleteCode('ABCD')).toBe(false);
  });

  it('is true at full length', () => {
    expect(isCompleteCode('ABCD2345')).toBe(true);
  });
});
