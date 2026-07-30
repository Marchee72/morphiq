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

/**
 * Message caps.
 *
 * Not validation theatre. Without them a "message" is an unbounded write
 * primitive pointed at another account's storage, and `payload` — which exists
 * to carry a shared routine — is the wider of the two doors.
 */
const MAX_BODY_CHARS = 2000;
const MAX_PAYLOAD_BYTES = 32_768;

/**
 * How long a session stays live without a heartbeat.
 *
 * Long enough to survive a heavy set, a rest and a lost signal; short enough
 * that an app killed mid-workout stops looking like somebody still in the gym.
 * A phone has no reliable goodbye, so a few minutes of ghost is the price.
 */
const PRESENCE_TTL_MINUTES = 3;

/**
 * Stream pacing.
 *
 * `LIFETIME` ends the response before the platform can cut it mid-frame — the
 * measured ceiling is at least 290s, and a clean end the client expects is
 * better than a truncated one it has to treat as an error. `POLL` is how often
 * the database is asked; two seconds is well under what anyone notices while
 * still being one indexed query per connected client.
 */
const STREAM_LIFETIME_MS = 280_000;
const STREAM_POLL_MS = 2_000;

/** Friendships change far less often than messages, so they are checked rarely. */
const LINK_POLL_EVERY = 10;

/**
 * How far back the presence window reaches on each tick.
 *
 * Presence is a snapshot keyed by profile and the client replaces by key, so
 * re-sending one costs nothing. Overlapping deliberately means a row written
 * between two ticks cannot fall through the gap — the trade that lets this work
 * on a timestamp rather than needing an exact monotonic cursor.
 */
const PRESENCE_OVERLAP_MS = 2_000;

/** `m<messageId>.p<presenceMs>` — two cursors, because two tables. */
function parseCursor(raw) {
  const text = typeof raw === 'string' ? raw : '';
  const message = /m(\d+)/.exec(text);
  const presence = /p(\d+)/.exec(text);
  return {
    messageId: message ? Number(message[1]) : 0,
    presenceAt: presence ? Number(presence[1]) : 0,
  };
}

function formatCursor(cursor) {
  return `m${cursor.messageId}.p${cursor.presenceAt}`;
}

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
    unreadCount: row.unreadCount ?? 0,
  };
}

/**
 * Named field by field, deliberately.
 *
 * Spreading the row would mean any column added to `live_sessions` later is
 * served to a partner the moment it exists. The table has no load columns
 * today; this makes sure that adding one is not enough to leak it.
 */
function toPresence(row) {
  return {
    profileId: String(row.profileId),
    linkId: String(row.linkId),
    sessionKey: row.sessionKey,
    startedAt: row.startedAt,
    exerciseName: row.exerciseName ?? undefined,
    exerciseIndex: row.exerciseIndex ?? undefined,
    exerciseCount: row.exerciseCount ?? undefined,
    setNumber: row.setNumber ?? undefined,
    setCount: row.setCount ?? undefined,
    setsDone: row.setsDone ?? 0,
    setsPlanned: row.setsPlanned ?? 0,
    updatedAt: row.updatedAt,
  };
}

function toMessage(row) {
  return {
    id: String(row.id),
    linkId: String(row.linkId),
    senderProfileId: String(row.senderProfileId),
    kind: row.kind,
    body: row.body ?? undefined,
    payload: row.payload ?? undefined,
    createdAt: row.createdAt,
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
         u.picture                AS "buddyPicture",
         (
           SELECT COUNT(*)::int FROM buddy_messages m
            WHERE m."linkId" = l.id
              -- Your own messages are never unread to you.
              AND m."senderProfileId" <> $1
              -- Past both cursors: what you have read, and what you cleared by
              -- leaving. Without the second, rejoining someone would surface a
              -- pile of unread from a conversation you deleted.
              AND m.id > GREATEST(
                    COALESCE(rm."lastReadMessageId", 0),
                    COALESCE(rm."clearedBeforeMessageId", 0)
                  )
         ) AS "unreadCount"
    FROM buddy_links l
    JOIN LATERAL (
      SELECT CASE WHEN l."profileIdA" = $1 THEN l."profileIdB" ELSE l."profileIdA" END AS other
    ) side ON TRUE
    LEFT JOIN user_profiles p ON p.id::text = side.other
    LEFT JOIN users u ON u.id = CASE WHEN l."profileIdA" = $1 THEN l."userIdB" ELSE l."userIdA" END
    LEFT JOIN buddy_read_marks rm ON rm."linkId" = l.id AND rm."profileId" = $1
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

  /** Live friendships only — a link somebody has left must not eat the ceiling. */
  async function buddyCount(profileId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM buddy_links
        WHERE ("profileIdA" = $1 OR "profileIdB" = $1)
          AND "removedByA" IS NULL AND "removedByB" IS NULL`,
      [String(profileId)],
    );
    return rows[0].n;
  }

  // ─── Buddies ──────────────────────────────────────────────────────────────

  router.get('/buddies', actingProfile, async (req, res) => {
    try {
      const profileId = String(req.query.profileId);
      const { rows } = await pool.query(
        `${LINK_SELECT}
          WHERE (l."profileIdA" = $1 OR l."profileIdB" = $1)
            AND l."removedByA" IS NULL AND l."removedByB" IS NULL
          ORDER BY l."createdAt" ASC`,
        [profileId],
      );
      res.json(rows.map(row => toBuddyLink(row, profileId)));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  /**
   * Leaves a friendship, taking only your own copy of it.
   *
   * Not a DELETE. Your transcript is yours and theirs is theirs, so removing a
   * partner must not reach across and destroy what they hold — which is exactly
   * what `ON DELETE CASCADE` would do.
   *
   * The friendship itself does end for both, and that asymmetry is deliberate:
   * a relationship one person has left is over, but ending it *silently* for
   * the other would leave them writing into a channel that goes nowhere. So the
   * link closes for everyone while each side keeps their own record.
   *
   * Once both have left, nobody can reach any of it and the row is collected.
   */
  router.delete('/buddies/:linkId', buddyLink, async (req, res) => {
    try {
      // Your copy goes first, by cursor: everything currently in the
      // conversation drops below your read line. The rows stay for the other
      // side, and this mark survives a later revival so what you deleted does
      // not reappear underneath a new friendship.
      await pool.query(
        `INSERT INTO buddy_read_marks ("linkId", "profileId", "clearedBeforeMessageId")
         VALUES ($1, $2, COALESCE((SELECT MAX(id) FROM buddy_messages WHERE "linkId" = $1), 0))
         ON CONFLICT ("linkId", "profileId") DO UPDATE
           SET "clearedBeforeMessageId" = EXCLUDED."clearedBeforeMessageId",
               "updatedAt" = NOW()`,
        [req.link.id, req.link.mine],
      );

      const column = req.link.isA ? 'removedByA' : 'removedByB';
      const { rows } = await pool.query(
        `UPDATE buddy_links SET "${column}" = NOW() WHERE id = $1 RETURNING *`,
        [req.link.id],
      );

      const link = rows[0];
      if (link.removedByA != null && link.removedByB != null) {
        // Unreachable by either account now, so there is nothing left to keep.
        await pool.query('DELETE FROM buddy_links WHERE id = $1', [req.link.id]);
      }
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

  // ─── Stream ───────────────────────────────────────────────────────────────

  /**
   * Everything that changes, pushed as it happens.
   *
   * Measured against a real preview before being built: Vercel does not buffer
   * `text/event-stream`, and a function survives at least 290 seconds. Both
   * were open questions the design hung on, and neither can be answered locally
   * where Node always streams fine. The third â€” whether the Capacitor WebView
   * parses frames incrementally rather than waiting for the body â€” was measured
   * on an Android 16 device (WebView 150) against a LAN server: 13 frames over
   * 60s, each 160â€“273ms behind the server's own clock, a gap that stayed flat
   * instead of collapsing into a clump at the end, which is what buffering looks
   * like. `fetch`, `getReader()` and `TextDecoder` behave as on the desktop.
   *
   * The fan-out is a poll against Postgres inside the handler. Two invocations
   * are two isolated processes, so there is no in-memory pub/sub to subscribe
   * to, and Neon's pooler does not carry `LISTEN/NOTIFY`. Polling one indexed
   * query every couple of seconds for one connected client is cheaper than
   * either alternative and works identically in development.
   *
   * Note `pool.query` per tick rather than a client held for the life of the
   * stream: holding one would pin a Neon connection for the whole five minutes.
   */
  router.get('/stream', actingProfile, async (req, res) => {
    const profileId = String(req.query.profileId);
    let cursor = parseCursor(req.query.since);
    let linkIds = [];
    let linkFingerprint = '';
    let timer = null;
    let closed = false;

    const send = (event, data, id) => {
      if (closed) return;
      if (id) res.write(`id: ${id}\n`);
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const stop = () => {
      closed = true;
      if (timer !== null) { clearInterval(timer); timer = null; }
    };

    // Without this the invocation keeps polling after the client hangs up, and
    // bills for every second of it.
    req.on('close', stop);

    try {
      res.set({
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        // Proxies buffer event streams unless told not to.
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();

      const startedAt = Date.now();

      /** Refreshes the caller's links and reports whether they changed. */
      async function refreshLinks() {
        const { rows } = await pool.query(
          `${LINK_SELECT}
            WHERE (l."profileIdA" = $1 OR l."profileIdB" = $1)
              AND l."removedByA" IS NULL AND l."removedByB" IS NULL
            ORDER BY l."createdAt" ASC`,
          [profileId],
        );
        linkIds = rows.map(row => Number(row.id));
        const links = rows.map(row => toBuddyLink(row, profileId));
        const fingerprint = JSON.stringify(links);
        const changed = fingerprint !== linkFingerprint;
        linkFingerprint = fingerprint;
        return { links, changed };
      }

      async function readPresence() {
        const { rows } = await pool.query(
          `SELECT ls.*, l.id AS "linkId"
             FROM live_sessions ls
             JOIN buddy_links l
               ON (l."profileIdA" = ls."profileId" AND l."profileIdB" = $1)
               OR (l."profileIdB" = ls."profileId" AND l."profileIdA" = $1)
             JOIN user_profiles p ON p.id::text = ls."profileId"
            WHERE ls."profileId" <> $1
              AND ls."endedAt" IS NULL
              AND ls."updatedAt" > NOW() - INTERVAL '${PRESENCE_TTL_MINUTES} minutes'
              AND l."blockedByProfileId" IS NULL
              AND l."removedByA" IS NULL AND l."removedByB" IS NULL
              AND COALESCE(p."sharePresence", TRUE) = TRUE`,
          [profileId],
        );
        return rows.map(toPresence);
      }

      const { links } = await refreshLinks();
      const presence = await readPresence();
      for (const entry of presence) {
        cursor.presenceAt = Math.max(cursor.presenceAt, new Date(entry.updatedAt).getTime());
      }

      // One snapshot on open, so a reconnecting client needs no separate GET
      // and a fresh one starts correct rather than empty.
      //
      // Carries the cursor as the frame id as well as in the body: the client
      // tracks position from `id`, so a stream that delivered only a hello and
      // then dropped would otherwise reconnect from zero and replay everything.
      send(
        'hello',
        { serverNow: new Date(), cursor: formatCursor(cursor), links, presence },
        formatCursor(cursor),
      );

      let tick = 0;
      /** Who was live on the previous tick, so a departure can be announced. */
      let lastLive = new Set(presence.map(entry => entry.profileId));

      timer = setInterval(async () => {
        if (closed) return;
        try {
          // Ends cleanly before the platform can cut mid-frame. The client
          // treats a clean end as ordinary and reconnects with its cursor.
          if (Date.now() - startedAt > STREAM_LIFETIME_MS) {
            send('bye', {});
            stop();
            res.end();
            return;
          }

          tick += 1;

          if (linkIds.length > 0) {
            const { rows } = await pool.query(
              // The cleared cursor is joined per link, exactly as the REST read
              // applies it. Without this the stream hands back the conversation
              // that leaving deleted — a paging cursor is not a permission, and
              // a fresh stream starts at zero.
              `SELECT m.* FROM buddy_messages m
                 LEFT JOIN buddy_read_marks rm
                   ON rm."linkId" = m."linkId" AND rm."profileId" = $3
                WHERE m."linkId" = ANY($1)
                  AND m.id > $2
                  AND m.id > COALESCE(rm."clearedBeforeMessageId", 0)
                ORDER BY m.id ASC LIMIT 200`,
              [linkIds, cursor.messageId, profileId],
            );
            for (const row of rows) {
              cursor.messageId = Math.max(cursor.messageId, Number(row.id));
              send('message', toMessage(row), formatCursor(cursor));
            }
          }

          // Presence is a snapshot keyed by profile, so re-sending one is
          // harmless — the client replaces by key. That is what lets the window
          // overlap rather than needing an exact cursor.
          const live = await readPresence();
          const seen = new Set();
          for (const entry of live) {
            seen.add(entry.profileId);
            const at = new Date(entry.updatedAt).getTime();
            if (at > cursor.presenceAt - PRESENCE_OVERLAP_MS) {
              send('presence', entry, formatCursor(cursor));
            }
            cursor.presenceAt = Math.max(cursor.presenceAt, at);
          }
          // Anyone who was live and is not now has finished or gone stale.
          for (const gone of [...lastLive].filter(id => !seen.has(id))) {
            send('presence.end', { profileId: gone });
          }
          lastLive = seen;

          // Friendships change far less often than messages do, so they are
          // checked every tenth tick rather than every one.
          if (tick % LINK_POLL_EVERY === 0) {
            const refreshed = await refreshLinks();
            if (refreshed.changed) send('buddy', { links: refreshed.links });
          }

          // Keeps proxies from closing an idle connection, and lets the client
          // tell a live stream from a dead socket.
          res.write(':hb\n\n');
        } catch {
          // A stream whose headers are already sent cannot answer 500 — the
          // catch-all in index.js would throw trying. End and let the client
          // reconnect with its cursor.
          stop();
          res.end();
        }
      }, STREAM_POLL_MS);
    } catch {
      stop();
      res.end();
    }
  });

  // ─── Presence ─────────────────────────────────────────────────────────────

  /**
   * Publishes where you are in the session you are doing right now.
   *
   * Every field is named individually, so anything else the client sends is
   * dropped on the floor. Together with the table having no load columns, that
   * is two independent reasons a weight cannot reach another account.
   *
   * The preference is enforced here as well as on the read side. Honouring it
   * only when reading would leave your presence sitting in the database anyway,
   * one forgotten `WHERE` away from being served.
   */
  router.put('/presence', actingProfile, async (req, res) => {
    try {
      const profileId = String(req.body.profileId);

      const { rows: prefs } = await pool.query(
        'SELECT "sharePresence" FROM user_profiles WHERE id = $1',
        [profileId],
      );
      if (prefs[0]?.sharePresence === false) {
        // Not an error. The client may keep publishing without knowing, and
        // switching the preference off has to take effect without waiting for
        // the app to notice.
        await pool.query('DELETE FROM live_sessions WHERE "profileId" = $1', [profileId]);
        return res.status(204).end();
      }

      const s = req.body.snapshot ?? {};
      await pool.query(
        `INSERT INTO live_sessions ("profileId", "sessionKey", "startedAt", "exerciseName",
                                    "exerciseIndex", "exerciseCount", "setNumber", "setCount",
                                    "setsDone", "setsPlanned", "updatedAt", "endedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW(), NULL)
         ON CONFLICT ("profileId") DO UPDATE
           SET "sessionKey" = EXCLUDED."sessionKey",
               "startedAt" = EXCLUDED."startedAt",
               "exerciseName" = EXCLUDED."exerciseName",
               "exerciseIndex" = EXCLUDED."exerciseIndex",
               "exerciseCount" = EXCLUDED."exerciseCount",
               "setNumber" = EXCLUDED."setNumber",
               "setCount" = EXCLUDED."setCount",
               "setsDone" = EXCLUDED."setsDone",
               "setsPlanned" = EXCLUDED."setsPlanned",
               "updatedAt" = NOW(),
               "endedAt" = NULL`,
        [
          profileId, String(s.sessionKey ?? ''), s.startedAt ?? new Date(),
          s.exerciseName ?? null, s.exerciseIndex ?? null, s.exerciseCount ?? null,
          s.setNumber ?? null, s.setCount ?? null,
          s.setsDone ?? 0, s.setsPlanned ?? 0,
        ],
      );
      res.status(204).end();
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  /** Finishing or discarding. Deleted rather than flagged — nothing reads history. */
  router.delete('/presence', actingProfile, async (req, res) => {
    try {
      await pool.query('DELETE FROM live_sessions WHERE "profileId" = $1', [
        String(req.query.profileId),
      ]);
      res.status(204).end();
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  /**
   * Which of your partners are training, and where they are in it.
   *
   * Staleness is a read predicate rather than a swept column, because
   * serverless has no daemon to sweep with.
   */
  router.get('/presence', actingProfile, async (req, res) => {
    try {
      const profileId = String(req.query.profileId);
      const { rows } = await pool.query(
        `SELECT ls.*, l.id AS "linkId"
           FROM live_sessions ls
           JOIN buddy_links l
             ON (l."profileIdA" = ls."profileId" AND l."profileIdB" = $1)
             OR (l."profileIdB" = ls."profileId" AND l."profileIdA" = $1)
           JOIN user_profiles p ON p.id::text = ls."profileId"
          WHERE ls."profileId" <> $1
            AND ls."endedAt" IS NULL
            AND ls."updatedAt" > NOW() - INTERVAL '${PRESENCE_TTL_MINUTES} minutes'
            AND l."blockedByProfileId" IS NULL
            AND l."removedByA" IS NULL AND l."removedByB" IS NULL
            -- Checked again on the way out: a preference switched off after the
            -- row was written must take effect now, not at the next heartbeat.
            AND COALESCE(p."sharePresence", TRUE) = TRUE`,
        [profileId],
      );

      // `serverNow` lets the client correct for the other phone's clock being
      // wrong, which would otherwise show an elapsed time minutes out.
      res.json({ serverNow: new Date(), presence: rows.map(toPresence) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── Messages ─────────────────────────────────────────────────────────────

  /**
   * The conversation, oldest first, from your side of it.
   *
   * "Your side" is the whole subtlety: anything at or below your cleared cursor
   * is gone for you and still there for them, so the filter is not an
   * optimisation and must not be dropped.
   */
  router.get('/buddies/:linkId/messages', buddyLink, async (req, res) => {
    try {
      const { rows: marks } = await pool.query(
        'SELECT "clearedBeforeMessageId" FROM buddy_read_marks WHERE "linkId" = $1 AND "profileId" = $2',
        [req.link.id, req.link.mine],
      );
      const cleared = marks[0]?.clearedBeforeMessageId ?? 0;
      // `sinceId` is the poll's cursor; the cleared mark is the floor under it.
      const since = Math.max(Number(req.query.sinceId ?? 0) || 0, cleared);

      const { rows } = await pool.query(
        `SELECT * FROM buddy_messages
          WHERE "linkId" = $1 AND id > $2
          ORDER BY id ASC
          LIMIT 500`,
        [req.link.id, since],
      );
      res.json(rows.map(toMessage));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/buddies/:linkId/messages', buddyLink, async (req, res) => {
    try {
      const { kind = 'text', body, payload } = req.body ?? {};
      if (!['text', 'routine', 'sessionInvite'].includes(kind)) {
        return res.status(400).json({ error: 'Unknown message kind' });
      }

      const text = typeof body === 'string' ? body.trim() : null;
      if (kind === 'text' && !text) return res.status(400).json({ error: 'Empty message' });

      // Caps, not validation theatre: without them `payload` is a primitive for
      // writing arbitrary JSON into someone else's account.
      if (text && text.length > MAX_BODY_CHARS) {
        return res.status(413).json({ error: 'Message too long' });
      }
      if (payload != null && JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
        return res.status(413).json({ error: 'Attachment too large' });
      }

      const { rows } = await pool.query(
        `INSERT INTO buddy_messages ("linkId", "senderProfileId", kind, body, payload)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        // The sender comes from the guard, never from the body — otherwise
        // anyone in a conversation could sign a message as the other person.
        [req.link.id, req.link.mine, kind, text, payload != null ? JSON.stringify(payload) : null],
      );
      res.status(201).json(toMessage(rows[0]));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  /** Moves your read line forward. Never backward — see the GREATEST. */
  router.post('/buddies/:linkId/read', buddyLink, async (req, res) => {
    try {
      const upTo = Number(req.body?.upToId ?? 0) || 0;
      await pool.query(
        `INSERT INTO buddy_read_marks ("linkId", "profileId", "lastReadMessageId")
         VALUES ($1, $2, $3)
         ON CONFLICT ("linkId", "profileId") DO UPDATE
           SET "lastReadMessageId" = GREATEST(buddy_read_marks."lastReadMessageId", EXCLUDED."lastReadMessageId"),
               "updatedAt" = NOW()`,
        [req.link.id, req.link.mine, upTo],
      );
      res.status(204).end();
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
        const found = existing[0];

        // A row somebody had left. Both of them have now said otherwise — one
        // minted a fresh code, the other redeemed it — so the friendship comes
        // back rather than colliding with the UNIQUE constraint forever.
        //
        // What does *not* come back is either side's cleared transcript: the
        // conversation they deleted stays deleted. That is the messages layer's
        // job, and the reason it must clear by cursor rather than by row.
        if (found.removedByA != null || found.removedByB != null) {
          // Reviving is a real outcome, so it spends the code — same conditional
          // claim as the fresh path, for the same reason: two phones must not
          // both succeed on one code.
          const { rows: claimed } = await pool.query(
            `UPDATE buddy_invites
                SET "redeemedAt" = NOW(), "redeemedByUserId" = $2, "redeemedByProfileId" = $3
              WHERE code = $1
                AND "redeemedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt" > NOW()
              RETURNING code`,
            [code, req.user.id, profileId],
          );
          if (claimed.length === 0) {
            await recordAttempt(req.user.id, 'redeem', false);
            return res.status(404).json({ error: 'That code is not valid' });
          }

          await pool.query(
            `UPDATE buddy_links SET "removedByA" = NULL, "removedByB" = NULL WHERE id = $1`,
            [found.id],
          );
          const { rows: fresh } = await pool.query(
            `${LINK_SELECT} WHERE l.id = $2`,
            [profileId, found.id],
          );
          await recordAttempt(req.user.id, 'redeem', true);
          return res.status(201).json(toBuddyLink(fresh[0], profileId));
        }

        // Already partners, and nothing changed — so the code is not spent.
        await recordAttempt(req.user.id, 'redeem', true);
        return res.status(200).json(toBuddyLink(found, profileId));
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
