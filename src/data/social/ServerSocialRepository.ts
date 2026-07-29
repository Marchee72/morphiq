import type { BuddyInvite, BuddyLink } from '../../core/entities/Buddy';
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
}
