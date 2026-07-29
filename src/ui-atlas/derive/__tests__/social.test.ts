import { describe, expect, it } from 'vitest';
import type { BuddyInvite, BuddyLink } from '../../../core/entities/Buddy';
import {
  buildBuddyRows, inviteHoursLeft, isCompleteCode, isInviteLive, normalizeInviteCode,
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
