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
 * Gives the first user to sign in the profiles that predate accounts.
 *
 * Runs once, by construction: after it, no profile has a null `user_id`, so the
 * UPDATE matches nothing. Without it the existing history would be stranded —
 * visible to nobody, owned by nobody.
 */
export async function adoptOrphanProfiles(pool, userId) {
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
 */
export async function ownedProfileIds(pool, req) {
  if (!req.user) return null;
  const { rows } = await pool.query('SELECT id FROM user_profiles WHERE user_id = $1', [req.user.id]);
  return rows.map(r => String(r.id));
}

/** Express guard for routes carrying a `:profileId`. */
export function guardProfile(pool) {
  return async (req, res, next) => {
    if (!req.user) return next();          // auth still optional
    const owned = await ownedProfileIds(pool, req);
    const requested = String(req.params.profileId ?? req.params.id ?? '');
    if (requested && owned && !owned.includes(requested)) {
      return res.status(403).json({ error: 'Not your profile' });
    }
    next();
  };
}
