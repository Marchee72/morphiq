import type {
  BuddyInvite, BuddyLink, BuddyMessage, BuddyMessageKind, BuddyPresence, LiveSessionSnapshot,
} from '../../core/entities/Buddy';
import type { ISocialRepository } from '../../core/interfaces/ISocial';
import { api } from '../database/apiClient';

/**
 * The only implementation of `ISocialRepository`, and the only place in the app
 * that reads anything belonging to another account.
 *
 * Uses the shared `api()` so a dead session clears itself here exactly as it
 * does everywhere else — a repository with its own fetch would keep firing
 * requests with a stale token and report each 401 as an ordinary failure.
 */

function parseLink(raw: Record<string, unknown>): BuddyLink {
  return { ...raw, createdAt: new Date(raw.createdAt as string) } as BuddyLink;
}

function parsePresence(raw: Record<string, unknown>): BuddyPresence {
  return {
    ...raw,
    startedAt: new Date(raw.startedAt as string),
    updatedAt: new Date(raw.updatedAt as string),
  } as BuddyPresence;
}

function parseMessage(raw: Record<string, unknown>): BuddyMessage {
  return { ...raw, createdAt: new Date(raw.createdAt as string) } as BuddyMessage;
}

function parseInvite(raw: Record<string, unknown>): BuddyInvite {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt as string),
    expiresAt: new Date(raw.expiresAt as string),
  } as BuddyInvite;
}

export class ServerSocialRepository implements ISocialRepository {
  async listBuddies(profileId: string): Promise<BuddyLink[]> {
    const rows = await api<Record<string, unknown>[]>(
      `/api/social/buddies?profileId=${encodeURIComponent(profileId)}`,
    );
    return rows.map(parseLink);
  }

  async removeBuddy(linkId: string): Promise<void> {
    await api(`/api/social/buddies/${linkId}`, { method: 'DELETE' });
  }

  async setBlocked(linkId: string, profileId: string, blocked: boolean): Promise<BuddyLink> {
    const raw = await api<Record<string, unknown>>(`/api/social/buddies/${linkId}/block`, {
      method: 'POST',
      body: JSON.stringify({ profileId, blocked }),
    });
    return parseLink(raw);
  }

  async getInvite(profileId: string): Promise<BuddyInvite | null> {
    const raw = await api<Record<string, unknown> | null>(
      `/api/social/invites?profileId=${encodeURIComponent(profileId)}`,
    );
    return raw ? parseInvite(raw) : null;
  }

  async createInvite(profileId: string): Promise<BuddyInvite> {
    const raw = await api<Record<string, unknown>>('/api/social/invites', {
      method: 'POST',
      body: JSON.stringify({ profileId }),
    });
    return parseInvite(raw);
  }

  async revokeInvite(code: string): Promise<void> {
    await api(`/api/social/invites/${encodeURIComponent(code)}`, { method: 'DELETE' });
  }

  async redeemInvite(profileId: string, code: string): Promise<BuddyLink> {
    const raw = await api<Record<string, unknown>>(
      `/api/social/invites/${encodeURIComponent(code)}/redeem`,
      { method: 'POST', body: JSON.stringify({ profileId }) },
    );
    return parseLink(raw);
  }

  async listMessages(linkId: string, sinceId?: string): Promise<BuddyMessage[]> {
    const query = sinceId ? `?sinceId=${encodeURIComponent(sinceId)}` : '';
    const rows = await api<Record<string, unknown>[]>(
      `/api/social/buddies/${linkId}/messages${query}`,
    );
    return rows.map(parseMessage);
  }

  async sendMessage(
    linkId: string,
    draft: { kind?: BuddyMessageKind; body?: string; payload?: unknown },
  ): Promise<BuddyMessage> {
    const raw = await api<Record<string, unknown>>(`/api/social/buddies/${linkId}/messages`, {
      method: 'POST',
      body: JSON.stringify(draft),
    });
    return parseMessage(raw);
  }

  async markRead(linkId: string, upToId: string): Promise<void> {
    await api(`/api/social/buddies/${linkId}/read`, {
      method: 'POST',
      body: JSON.stringify({ upToId: Number(upToId) }),
    });
  }

  async listPresence(profileId: string): Promise<{ serverNow: Date; presence: BuddyPresence[] }> {
    const raw = await api<{ serverNow: string; presence: Record<string, unknown>[] }>(
      `/api/social/presence?profileId=${encodeURIComponent(profileId)}`,
    );
    return { serverNow: new Date(raw.serverNow), presence: raw.presence.map(parsePresence) };
  }

  async publishPresence(profileId: string, snapshot: LiveSessionSnapshot): Promise<void> {
    await api('/api/social/presence', {
      method: 'PUT',
      body: JSON.stringify({ profileId, snapshot }),
    });
  }

  async endPresence(profileId: string): Promise<void> {
    await api(`/api/social/presence?profileId=${encodeURIComponent(profileId)}`, {
      method: 'DELETE',
    });
  }
}
