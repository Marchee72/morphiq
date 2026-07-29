/**
 * Training partners: invitations and the friendships they create.
 *
 * Kept out of `index.js` deliberately. Not for length alone — these are the only
 * routes in the app where one account can see anything belonging to another, and
 * a reader should be able to audit that surface without reading 700 lines of
 * single-owner CRUD first.
 *
 * Every route here is mounted behind `requireUser`, so `req.user` is always
 * present and `owns()` — which lets anonymous requests through — is never used.
 */
import express from 'express';
import { guardActingProfile, guardBuddyLink, ownsStrict } from './auth.js';

/**
 * No `0/O`, no `1/I/L`. A code's whole job is to survive being read aloud in a
 * noisy gym or retyped from a screenshot, and those are the pairs people get
 * wrong. 30 symbols over 8 places is still ~6.6e11 codes.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

/**
 * Long enough to send someone a code and have them open it after work, short
 * enough that a code left in a chat log stops being a key by the weekend.
 */
const INVITE_TTL_HOURS = 72;

/** Guessing is impractical at 6.6e11 codes; this is what stops trying anyway. */
const REDEEM_ATTEMPTS_PER_HOUR = 10;

/**
 * A ceiling, not a product decision. Without one, a single account can mint
 * links until the presence query is doing real work on every poll.
 */
const MAX_BUDDIES = 20;

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Orders a pair of profile ids so a friendship has one canonical row.
 *
 * Sorted numerically rather than lexically: the ids are `SERIAL`s carried in
 * TEXT columns, and '10' sorts before '9' as a string. A lexical sort would
 * still be consistent, but only until someone writes a query that assumes
 * otherwise — numeric is the order the ids actually have.
 */
function orderPair(a, b) {
  return Number(a) <= Number(b) ? [String(a), String(b)] : [String(b), String(a)];
}

/** The shape the client reads. Never exposes the other side's email. */
function toBuddyLink(row, myProfileId) {
  const onA = String(row.profileIdA) === String(myProfileId);
  return {
    id: String(row.id),
    myProfileId: String(myProfileId),
    buddyProfileId: String(onA ? row.profileIdB : row.profileIdA),
    buddyName: row.buddyName ?? '',
    buddyPicture: row.buddyPicture ?? undefined,
    createdAt: row.createdAt,
    blockedByMe: row.blockedByProfileId != null
      && String(row.blockedByProfileId) === String(myProfileId),
    blockedByThem: row.blockedByProfileId != null
      && String(row.blockedByProfileId) !== String(myProfileId),
  };
}

function toInvite(row) {
  return {
    code: row.code,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

/**
 * One friendship, with the other side's display name resolved.
 *
 * The name comes from the profile first and the Google account second: the
 * profile name is what someone chose inside the app, and it is the name their
 * training is filed under.
 */
const LINK_SELECT = `
  SELECT l.*,
         COALESCE(p.name, u.name) AS "buddyName",
         u.picture                AS "buddyPicture"
    FROM buddy_links l
    JOIN LATERAL (
      SELECT CASE WHEN l."profileIdA" = $1 THEN l."profileIdB" ELSE l."profileIdA" END AS other
    ) side ON TRUE
    LEFT JOIN user_profiles p ON p.id::text = side.other
    LEFT JOIN users u ON u.id = CASE WHEN l."profileIdA" = $1 THEN l."userIdB" ELSE l."userIdA" END
`;

export function socialRoutes(pool) {
  const router = express.Router();
  const actingProfile = guardActingProfile(pool);
  const buddyLink = guardBuddyLink(pool);

  /** Records an attempt so the rate limit has something to count. */
  async function recordAttempt(userId, action, succeeded) {
    await pool.query(
      'INSERT INTO social_attempts ("userId", action, succeeded) VALUES ($1, $2, $3)',
      [userId, action, succeeded],
    );
  }

  async function tooManyAttempts(userId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM social_attempts
        WHERE "userId" = $1 AND action = 'redeem' AND "at" > NOW() - INTERVAL '1 hour'`,
      [userId],
    );
    return rows[0].n >= REDEEM_ATTEMPTS_PER_HOUR;
  }

  async function buddyCount(profileId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM buddy_links
        WHERE "profileIdA" = $1 OR "profileIdB" = $1`,
      [String(profileId)],
    );
    return rows[0].n;
  }

  // ─── Buddies ──────────────────────────────────────────────────────────────

  router.get('/buddies', actingProfile, async (req, res) => {
    try {
      const profileId = String(req.query.profileId);
      const { rows } = await pool.query(
        `${LINK_SELECT} WHERE l."profileIdA" = $1 OR l."profileIdB" = $1
          ORDER BY l."createdAt" ASC`,
        [profileId],
      );
      res.json(rows.map(row => toBuddyLink(row, profileId)));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  /**
   * Ends a friendship outright.
   *
   * Everything hanging off the link goes with it, for both people. That is the
   * stated position rather than an accident of `ON DELETE CASCADE`: a one-sided
   * delete would leave the other person holding a copy of a conversation you
   * were told had been removed. The client says so before it calls this.
   */
  router.delete('/buddies/:linkId', buddyLink, async (req, res) => {
    try {
      await pool.query('DELETE FROM buddy_links WHERE id = $1', [req.link.id]);
      res.status(204).end();
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  /**
   * Blocks or unblocks, keeping the link and its messages.
   *
   * Not behind `guardBuddyLink`: that guard refuses an already-blocked link, so
   * routing unblock through it would make the block permanent. Ownership is
   * checked here instead, against the row as it actually stands.
   */
  router.post('/buddies/:linkId/block', async (req, res) => {
    try {
      const { blocked, profileId } = req.body ?? {};
      if (profileId == null) return res.status(400).json({ error: 'Missing profileId' });
      if (!(await ownsStrict(pool, req, profileId))) {
        return res.status(403).json({ error: 'Not your data' });
      }

      const { rows } = await pool.query('SELECT * FROM buddy_links WHERE id = $1', [
        /^\d+$/.test(String(req.params.linkId)) ? req.params.linkId : 0,
      ]);
      if (rows.length === 0) return res.status(404).json({ error: 'No such link' });

      const link = rows[0];
      const mine = String(profileId);
      if (String(link.profileIdA) !== mine && String(link.profileIdB) !== mine) {
        return res.status(403).json({ error: 'Not your data' });
      }
      // Only the side that blocked may lift it, or a block would be a mutual
      // switch either person could flip back.
      if (!blocked && link.blockedByProfileId != null
          && String(link.blockedByProfileId) !== mine) {
        return res.status(403).json({ error: 'Not your data' });
      }

      const { rows: updated } = await pool.query(
        `UPDATE buddy_links
            SET "blockedByProfileId" = $2, "blockedAt" = $3
          WHERE id = $1 RETURNING *`,
        [link.id, blocked ? mine : null, blocked ? new Date() : null],
      );
      res.json(toBuddyLink(updated[0], mine));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── Invitations ──────────────────────────────────────────────────────────

  /** The profile's live invitation, if it still has one. */
  router.get('/invites', actingProfile, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM buddy_invites
          WHERE "inviterProfileId" = $1
            AND "redeemedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt" > NOW()
          ORDER BY "createdAt" DESC LIMIT 1`,
        [String(req.query.profileId)],
      );
      res.json(rows.length ? toInvite(rows[0]) : null);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  /**
   * Mints a code, revoking whatever the profile had before.
   *
   * One live code at a time. Otherwise every code ever generated stays valid
   * until it expires, and "generate a new one" — which people press precisely
   * because they want the old one dead — would quietly do the opposite.
   */
  router.post('/invites', actingProfile, async (req, res) => {
    try {
      const profileId = String(req.body.profileId);

      if (await buddyCount(profileId) >= MAX_BUDDIES) {
        return res.status(409).json({ error: 'Too many partners' });
      }

      await pool.query(
        `UPDATE buddy_invites SET "revokedAt" = NOW()
          WHERE "inviterProfileId" = $1 AND "redeemedAt" IS NULL AND "revokedAt" IS NULL`,
        [profileId],
      );

      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600_000);

      // Collisions are vanishingly unlikely and entirely survivable; retrying is
      // cheaper than reasoning about whether they can happen.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const { rows } = await pool.query(
            `INSERT INTO buddy_invites (code, "inviterUserId", "inviterProfileId", "expiresAt")
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [generateCode(), req.user.id, profileId, expiresAt],
          );
          return res.status(201).json(toInvite(rows[0]));
        } catch (err) {
          if (err.code !== '23505') throw err;
        }
      }
      res.status(500).json({ error: 'Could not allocate a code' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/invites/:code', async (req, res) => {
    try {
      const { rows } = await pool.query(
        `UPDATE buddy_invites SET "revokedAt" = NOW()
          WHERE code = $1 AND "inviterUserId" = $2 AND "redeemedAt" IS NULL
          RETURNING id`,
        [String(req.params.code).toUpperCase(), req.user.id],
      );
      if (rows.length === 0) return res.status(404).json({ error: 'No such code' });
      res.status(204).end();
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  /**
   * Redeems a code into a friendship.
   *
   * The order of the checks is the design. Everything that can refuse the
   * request runs *before* the code is claimed, because claiming is what burns
   * it — failing afterwards would leave the inviter's code spent on a request
   * that never became a friendship, and no way to tell them why.
   *
   * The claim itself is a conditional UPDATE rather than a SELECT followed by an
   * UPDATE: single-use has to survive two phones redeeming the same code at the
   * same moment, and only the database can decide that.
   */
  router.post('/invites/:code/redeem', actingProfile, async (req, res) => {
    const profileId = String(req.body.profileId);
    const code = String(req.params.code).toUpperCase();

    try {
      if (await tooManyAttempts(req.user.id)) {
        return res.status(429).json({ error: 'Too many attempts' });
      }

      const { rows: found } = await pool.query(
        'SELECT * FROM buddy_invites WHERE code = $1',
        [code],
      );
      const invite = found[0];

      // One answer for "no such code" and for "expired, spent or withdrawn":
      // distinguishing them tells someone guessing which of their guesses were
      // real codes.
      const unusable = !invite
        || invite.redeemedAt != null
        || invite.revokedAt != null
        || new Date(invite.expiresAt) <= new Date();
      if (unusable) {
        await recordAttempt(req.user.id, 'redeem', false);
        return res.status(404).json({ error: 'That code is not valid' });
      }

      // Your own code. Not an attack, just the obvious mistake — and with more
      // than one profile on an account it would otherwise create a friendship
      // between two of your own profiles.
      if (invite.inviterUserId === req.user.id) {
        await recordAttempt(req.user.id, 'redeem', false);
        return res.status(400).json({ error: 'That is your own code' });
      }

      const [profileIdA, profileIdB] = orderPair(invite.inviterProfileId, profileId);

      const { rows: existing } = await pool.query(
        `${LINK_SELECT} WHERE l."profileIdA" = $2 AND l."profileIdB" = $3`,
        [profileId, profileIdA, profileIdB],
      );
      if (existing.length > 0) {
        await recordAttempt(req.user.id, 'redeem', true);
        return res.status(200).json(toBuddyLink(existing[0], profileId));
      }

      if (await buddyCount(profileId) >= MAX_BUDDIES
          || await buddyCount(invite.inviterProfileId) >= MAX_BUDDIES) {
        await recordAttempt(req.user.id, 'redeem', false);
        return res.status(409).json({ error: 'Too many partners' });
      }

      const { rows: claimed } = await pool.query(
        `UPDATE buddy_invites
            SET "redeemedAt" = NOW(), "redeemedByUserId" = $2, "redeemedByProfileId" = $3
          WHERE code = $1
            AND "redeemedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt" > NOW()
          RETURNING *`,
        [code, req.user.id, profileId],
      );
      if (claimed.length === 0) {
        // Someone else redeemed it between the read above and here.
        await recordAttempt(req.user.id, 'redeem', false);
        return res.status(404).json({ error: 'That code is not valid' });
      }

      const [userIdA, userIdB] = String(invite.inviterProfileId) === profileIdA
        ? [invite.inviterUserId, req.user.id]
        : [req.user.id, invite.inviterUserId];

      await pool.query(
        `INSERT INTO buddy_links ("profileIdA", "profileIdB", "userIdA", "userIdB")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("profileIdA", "profileIdB") DO NOTHING`,
        [profileIdA, profileIdB, userIdA, userIdB],
      );

      const { rows: created } = await pool.query(
        `${LINK_SELECT} WHERE l."profileIdA" = $2 AND l."profileIdB" = $3`,
        [profileId, profileIdA, profileIdB],
      );
      await recordAttempt(req.user.id, 'redeem', true);
      res.status(201).json(toBuddyLink(created[0], profileId));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
