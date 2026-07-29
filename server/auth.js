/**
 * Google sign-in: token verification, sessions, and the middleware that closes
 * the API.
 *
 * The ID token is verified here, against Google's keys. Trusting what the client
 * sends about who it is would leave the API exactly as open as it was before.
 */
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

/** Both client ids are valid audiences — web and Android issue different ones. */
const AUDIENCES = [
  process.env.GOOGLE_WEB_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
].filter(Boolean);

const SESSION_TTL = '30d';
const googleClient = new OAuth2Client();

/**
 * While this is false the API accepts unauthenticated requests, so a deployment
 * can go out before the clients that send tokens. Flipped on once every client
 * is updated — the other order breaks the app already on the phone.
 */
export const authRequired = process.env.AUTH_REQUIRED === 'true';

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  return secret;
}

/** Verifies a Google ID token and returns its claims, or throws. */
export async function verifyGoogleToken(idToken) {
  if (AUDIENCES.length === 0) throw new Error('No Google client ids configured');
  const ticket = await googleClient.verifyIdToken({ idToken, audience: AUDIENCES });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw new Error('Token carries no subject');
  // Google signs tokens for many products; only these issuers are ours.
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
    throw new Error('Unexpected issuer');
  }
  return payload;
}

export function issueSession(user) {
  return jwt.sign({ uid: user.id, sub: user.google_sub }, sessionSecret(), { expiresIn: SESSION_TTL });
}

export function readSession(token) {
  try {
    return jwt.verify(token, sessionSecret());
  } catch {
    return null;
  }
}

/** Finds or creates the user behind a verified Google payload. */
export async function upsertUser(pool, payload) {
  const { rows } = await pool.query(
    `INSERT INTO users (google_sub, email, name, picture, "lastSeenAt")
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (google_sub) DO UPDATE
       SET email = EXCLUDED.email,
           name = EXCLUDED.name,
           picture = EXCLUDED.picture,
           "lastSeenAt" = NOW()
     RETURNING *`,
    [payload.sub, payload.email ?? null, payload.name ?? null, payload.picture ?? null],
  );
  return rows[0];
}

/**
 * Claims the profiles that predate accounts.
 *
 * Restricted to `OWNER_EMAIL`, and that restriction is the whole point. The
 * rule used to be "whoever signs in first" — which is safe on a private
 * deployment and actively dangerous the moment the URL is shared: a stranger
 * signing in before the owner would inherit the owner's entire training and
 * body-composition history.
 *
 * With no `OWNER_EMAIL` set nothing is adopted at all. The pre-account rows stay
 * where they are, owned by nobody and visible to nobody, until the variable is
 * set and the right account signs in — losing sight of the data is recoverable,
 * handing it to the wrong person is not.
 *
 * Self-limiting either way: afterwards no profile has a null `user_id`, so the
 * UPDATE matches nothing.
 */
export async function adoptOrphanProfiles(pool, userId, email) {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!owner) {
    console.warn('OWNER_EMAIL is not set — leaving pre-account profiles unowned');
    return 0;
  }
  if (!email || email.trim().toLowerCase() !== owner) return 0;

  const { rowCount } = await pool.query(
    `UPDATE user_profiles SET user_id = $1
      WHERE user_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id IS NOT NULL)`,
    [userId],
  );
  if (rowCount > 0) console.log(`Adopted ${rowCount} unowned profile(s) into user ${userId}`);
  return rowCount;
}

/**
 * Attaches `req.user` when a valid session is present.
 *
 * With `authRequired` off, an anonymous request continues unauthenticated
 * rather than being rejected — that is what makes the staged rollout possible.
 */
export function authenticate(pool) {
  return async (req, res, next) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const claims = token ? readSession(token) : null;

    if (claims?.uid) {
      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [claims.uid]);
      if (rows[0]) req.user = rows[0];
    }

    if (!req.user && authRequired) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  };
}

/**
 * Confines a request to the caller's own profiles.
 *
 * Requiring a session is only half the job: without this, any signed-in user
 * could still read `/api/profiles/1`. Returns the profile ids the caller owns,
 * or null while auth is optional and nobody is signed in.
 *
 * Memoised on the request, because several guards can run on one route and the
 * answer cannot change mid-request.
 */
export async function ownedProfileIds(pool, req) {
  if (!req.user) return null;
  if (!req._ownedProfileIds) {
    req._ownedProfileIds = pool
      .query('SELECT id FROM user_profiles WHERE user_id = $1', [req.user.id])
      .then(({ rows }) => rows.map(r => String(r.id)));
  }
  return req._ownedProfileIds;
}

/**
 * True when `profileId` belongs to the caller.
 *
 * A null owned-set means auth is still optional and nobody is signed in, which
 * every guard below reads as "let it through" — that is what makes the staged
 * rollout possible. Once `AUTH_REQUIRED` is on, `authenticate` has already
 * rejected the anonymous case before any of this runs.
 */
async function owns(pool, req, profileId) {
  const owned = await ownedProfileIds(pool, req);
  if (owned === null) return true;
  return owned.includes(String(profileId));
}

const DENIED = { error: 'Not your data' };

/** Express guard for routes carrying a `:profileId` (or `:id`) in the path. */
export function guardProfile(pool) {
  return async (req, res, next) => {
    if (!req.user) return next();
    const requested = String(req.params.profileId ?? req.params.id ?? '');
    if (requested && !(await owns(pool, req, requested))) {
      return res.status(403).json(DENIED);
    }
    next();
  };
}

/**
 * Guard for writes that name their profile in the body.
 *
 * `POST /api/measurements` and friends take `profileId` as a field, so the path
 * guard never sees them — a signed-in user could write a weigh-in straight into
 * someone else's history.
 */
export function guardBodyProfile(pool) {
  return async (req, res, next) => {
    if (!req.user) return next();
    const requested = req.body?.profileId;
    // A missing profileId is the handler's problem to reject, not the guard's:
    // failing it here would turn a 500 into a confusing 403.
    if (requested != null && !(await owns(pool, req, requested))) {
      return res.status(403).json(DENIED);
    }
    next();
  };
}

/** The same, for the routes that pass `profileId` as a query parameter. */
export function guardQueryProfile(pool) {
  return async (req, res, next) => {
    if (!req.user) return next();
    const requested = req.query?.profileId;
    if (requested != null && !(await owns(pool, req, requested))) {
      return res.status(403).json(DENIED);
    }
    next();
  };
}

/**
 * Guard for routes that address a single row by its own id.
 *
 * `DELETE /api/measurements/:id` and `PUT /api/workout-logs/:id` carry nothing
 * that identifies a profile, so ownership has to be resolved through the row
 * itself. Every data table carries a `"profileId"`, which is what makes one
 * guard enough for all of them.
 *
 * A row that does not exist passes through: there is nothing to leak, and
 * answering 403 here would turn today's idempotent DELETE into an error.
 */
export function guardRow(pool, table, param = 'id') {
  return async (req, res, next) => {
    if (!req.user) return next();
    const id = String(req.params[param] ?? '');
    // Ids are `SERIAL`; anything else cannot name a row, and passing it to
    // Postgres would raise an invalid-input error rather than return nothing.
    if (!/^\d+$/.test(id)) return next();

    const { rows } = await pool.query(`SELECT "profileId" FROM ${table} WHERE id = $1`, [id]);
    if (rows.length === 0) return next();
    if (!(await owns(pool, req, rows[0].profileId))) return res.status(403).json(DENIED);
    next();
  };
}

// ─── Social ──────────────────────────────────────────────────────────────────
//
// Everything above answers one question: "is this row yours?". The social
// routes need a second one — "is this row shared with you?" — and they must
// answer it without inheriting the rollout concession baked into `owns()`.
//
// That concession is the whole reason these live apart. `owns()` returns true
// when nobody is signed in, so that the app already on the phone keeps working
// until `AUTH_REQUIRED` goes on. On single-owner data that is harmless: an
// anonymous caller sees rows that were already unowned. On a friendship it
// would mean an anonymous request reads a conversation between two people.

/**
 * Closes a route to anonymous callers, whatever `AUTH_REQUIRED` says.
 *
 * The staged rollout does not apply here: none of this existed before accounts
 * did, so there is no older client to keep serving.
 */
export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

/** `owns`, without the branch that lets an anonymous request through. */
export async function ownsStrict(pool, req, profileId) {
  const owned = await ownedProfileIds(pool, req);
  if (owned === null) return false;
  return owned.includes(String(profileId));
}

/**
 * Guard for social routes that name the acting profile in the body or query.
 *
 * Unlike `guardBodyProfile`, a missing profile is refused rather than left to
 * the handler: every social route acts *as* one of your profiles, and one that
 * does not say which cannot be authorised at all.
 */
export function guardActingProfile(pool) {
  return async (req, res, next) => {
    const requested = req.body?.profileId ?? req.query?.profileId;
    if (requested == null) return res.status(400).json({ error: 'Missing profileId' });
    if (!(await ownsStrict(pool, req, requested))) return res.status(403).json(DENIED);
    next();
  };
}

/**
 * Guard for routes addressing one friendship, resolved through the link row.
 *
 * Attaches `req.link = { id, mine, theirs }` so handlers never re-derive which
 * side of the row the caller is standing on — getting that backwards would send
 * a message signed as the other person.
 *
 * Two deliberate differences from `guardRow`:
 *
 * A link that does not exist answers **404, not pass-through**. `guardRow` lets
 * a missing row past because there is nothing to leak and refusing would break
 * an idempotent DELETE. Here the existence of link 431 is itself a fact about
 * two other people, and walking the id space to collect 403s would map out who
 * is connected to whom.
 *
 * A blocked link answers 403 from **either** side. Blocking is not one-way
 * silence: the person who blocked stops being visible too, or "block" would
 * only mean "stop hearing from them" while still broadcasting to them.
 */
export function guardBuddyLink(pool, param = 'linkId') {
  return async (req, res, next) => {
    const id = String(req.params[param] ?? '');
    // Ids are SERIAL; a non-numeric one cannot name a row, and handing it to
    // Postgres raises an invalid-input error instead of matching nothing.
    if (!/^\d+$/.test(id)) return res.status(404).json({ error: 'No such link' });

    const { rows } = await pool.query('SELECT * FROM buddy_links WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'No such link' });

    const link = rows[0];
    const owned = await ownedProfileIds(pool, req);
    if (owned === null) return res.status(403).json(DENIED);

    const onA = owned.includes(String(link.profileIdA));
    const onB = owned.includes(String(link.profileIdB));
    if (!onA && !onB) return res.status(403).json(DENIED);
    if (link.blockedByProfileId != null) return res.status(403).json(DENIED);
    // Either side having left ends the friendship for both. Their transcript
    // survives on their own device's account, but the channel does not — the
    // alternative leaves someone writing into a link that silently goes nowhere.
    if (link.removedByA != null || link.removedByB != null) {
      return res.status(404).json({ error: 'No such link' });
    }

    req.link = {
      id: String(link.id),
      mine: String(onA ? link.profileIdA : link.profileIdB),
      theirs: String(onA ? link.profileIdB : link.profileIdA),
      // Which stored column is yours. The pair is held in canonical order, so
      // "am I A or B" is not derivable from the ids without repeating the sort.
      isA: onA,
    };
    next();
  };
}

/**
 * The profiles the caller may legitimately *observe*: their own, plus the ones
 * on the other end of an active friendship.
 *
 * Deliberately wider than `ownedProfileIds` and deliberately not a replacement
 * for it — this set may read presence, and nothing else. Every route that reads
 * training data keeps using the narrow one.
 *
 * Memoised on the request for the same reason: several handlers can ask, and
 * the answer cannot change mid-request.
 */
export async function visibleProfileIds(pool, req) {
  const owned = await ownedProfileIds(pool, req);
  if (owned === null) return [];
  if (!req._visibleProfileIds) {
    req._visibleProfileIds = pool
      .query(
        `SELECT "profileIdA", "profileIdB" FROM buddy_links
          WHERE ("profileIdA" = ANY($1) OR "profileIdB" = ANY($1))
            AND "blockedByProfileId" IS NULL
            AND "removedByA" IS NULL AND "removedByB" IS NULL`,
        [owned],
      )
      .then(({ rows }) => {
        const seen = new Set(owned);
        for (const row of rows) {
          seen.add(String(row.profileIdA));
          seen.add(String(row.profileIdB));
        }
        return [...seen];
      });
  }
  return req._visibleProfileIds;
}

/**
 * Guard for the two routes keyed by `workoutLogId`.
 *
 * Resolved through `workout_sets` rather than `workout_logs`, because the column
 * is `TEXT` there — `workout_logs.id` is a `SERIAL`, and the client is free to
 * pass a non-numeric log id, which would raise a cast error instead of matching
 * nothing.
 */
export function guardWorkoutSets(pool) {
  return async (req, res, next) => {
    if (!req.user) return next();
    const { rows } = await pool.query(
      'SELECT DISTINCT "profileId" FROM workout_sets WHERE "workoutLogId" = $1',
      [String(req.params.workoutLogId ?? '')],
    );
    for (const row of rows) {
      if (!(await owns(pool, req, row.profileId))) return res.status(403).json(DENIED);
    }
    next();
  };
}
