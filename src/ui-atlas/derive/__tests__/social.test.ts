import { describe, expect, it } from 'vitest';
import type { BuddyInvite, BuddyLink, BuddyMessage } from '../../../core/entities/Buddy';
import {
  buildBuddyRows, buildMessageDays, inviteHoursLeft, isCompleteCode, isInviteLive,
  normalizeInviteCode, totalUnread,
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

  it('leaves out kinds that have no text to draw yet', () => {
    // Routine and session-invite messages arrive with the stages that know how
    // to render them; until then drawing a blank bubble would be worse.
    const days = buildMessageDays([
      message({ id: '1', kind: 'routine', body: undefined }),
      message({ id: '2' }),
    ], '1');

    expect(days[0].messages.map(m => m.id)).toEqual(['2']);
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
