import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * What stops an offline replay filing the same workout twice.
 *
 * A phone that loses signal mid-write cannot tell "the request never arrived"
 * from "it arrived and the answer was lost". It has to retry either way, so the
 * server has to recognise the second attempt — which it does through a
 * `"clientId"` the client picked before sending. `finishActiveSession` carries a
 * comment about sessions in production logged three times over from exactly the
 * failure this prevents.
 *
 * These assertions read the source rather than exercising a running server, and
 * it is worth being straight about what that can and cannot show. It cannot
 * prove Postgres resolves the conflict correctly — only a real database does
 * that, and the manual check is: POST the same `clientId` twice, expect one row
 * and the same id both times. What it does catch is the regression that is
 * actually likely, which is someone adding a seventh replayable insert, or
 * editing one of these six, without the clause. A fake pool would not have
 * caught that any better, and would have implied a guarantee it could not keep.
 */

const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = readFileSync(join(serverDir, 'index.js'), 'utf8');
const migration = readFileSync(join(serverDir, 'migrations', '008_client_ids.sql'), 'utf8');

/** Every table whose inserts a device can replay from its outbox. */
const REPLAYABLE = [
  'measurements',
  'food_logs',
  'workout_logs',
  'workout_sets',
  'routine_templates',
  'messages',
];

/** The text of a single `INSERT INTO <table> …` statement in the handlers. */
function insertInto(table) {
  const match = index.match(new RegExp(`INSERT INTO ${table} \\([^)]*\\)[\\s\\S]*?RETURNING \\*`));
  return match?.[0];
}

describe('migration 008', () => {
  it.each(REPLAYABLE)('gives %s a clientId column', (table) => {
    expect(migration).toContain(`ALTER TABLE ${table}`.replace(/ {2,}/g, ' '));
    expect(migration).toMatch(new RegExp(`ALTER TABLE ${table}\\s+ADD COLUMN IF NOT EXISTS "clientId" TEXT`));
  });

  it.each(REPLAYABLE)('scopes %s\'s uniqueness to the profile, not globally', (table) => {
    // A global index would match a key against every row in the table, so a
    // replayed or guessed clientId would hand back another account's row id —
    // a probe for someone else's data through what looks like a write detail.
    expect(migration).toMatch(
      new RegExp(`CREATE UNIQUE INDEX IF NOT EXISTS \\w+\\s+ON ${table}\\("profileId", "clientId"\\)`)
    );
  });

  it('is replayable, because initDb runs every migration on every cold start', () => {
    // Comments go first: prose is allowed a semicolon, and splitting before
    // stripping would hand this loop a fragment of an English sentence.
    const statements = migration
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);

    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      // No bare CREATE/ALTER: a second cold start would throw and take the
      // whole boot down with it.
      expect(statement).toMatch(/IF NOT EXISTS/);
    }
  });

  it('gives workout_sets the two columns its INSERT has always dropped', () => {
    // The client has sent both since gym mode existed and the table had neither,
    // so every set written in server mode lost them silently.
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "isCompleted" BOOLEAN');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "biserieGroupId" TEXT');
  });
});

describe('the conflict clause', () => {
  it('updates rather than doing nothing, so RETURNING still yields the row', () => {
    // `DO NOTHING` returns no row, and a replaying client is asking precisely
    // because it does not know the id yet — it would get `undefined` back and
    // never resolve its temp id.
    expect(index).toMatch(
      /ON CONFLICT \("profileId", "clientId"\) DO UPDATE SET "clientId" = EXCLUDED\."clientId"/
    );
    expect(index).not.toContain('ON CONFLICT ("profileId", "clientId") DO NOTHING');
  });
});

describe('the replayable inserts', () => {
  it.each(REPLAYABLE)('%s names clientId and carries the conflict clause', (table) => {
    const sql = insertInto(table);
    expect(sql, `no INSERT found for ${table}`).toBeTruthy();
    expect(sql).toContain('"clientId"');
    expect(sql).toContain('${ON_CLIENT_ID_CONFLICT}');
  });

  it.each(REPLAYABLE)('%s binds the clientId as a parameter', (table) => {
    // Interpolating it would put a client-supplied string into the SQL text.
    const sql = insertInto(table);
    expect(sql).not.toMatch(/\$\{[^}]*clientId/i);
  });

  it('sends workout_sets its isCompleted and biserieGroupId', () => {
    const sql = insertInto('workout_sets');
    expect(sql).toContain('"isCompleted"');
    expect(sql).toContain('"biserieGroupId"');
  });

  it.each(REPLAYABLE)('%s counts its placeholders against its columns', (table) => {
    // The failure this catches is silent and total: add a column, forget a
    // placeholder, and every write to the table 500s.
    const sql = insertInto(table);
    const columns = sql.match(/INSERT INTO \w+ \(([^)]*)\)/)[1].split(',').length;
    const placeholders = new Set(sql.match(/\$\d+/g)).size;
    expect(placeholders, `${table}: ${columns} columns, ${placeholders} placeholders`).toBe(columns);
  });
});

describe('what deliberately has no clientId', () => {
  it.each(['wellness_logs', 'exercise_favorites'])('leaves %s alone — it is already idempotent', (table) => {
    // `wellness_logs` is keyed UNIQUE(profileId, day) with a real upsert, and
    // `exercise_favorites` UNIQUE(profileId, exerciseId). Both already answer a
    // replay correctly; a second key would be a second thing to keep right.
    expect(migration).not.toContain(`ALTER TABLE ${table}`);
  });

  it('leaves user_profiles alone', () => {
    // Creating a profile means getting past the auth gate, which offline
    // requires a snapshot, which requires a profile. There is no reachable path
    // that creates one without a connection.
    expect(migration).not.toContain('ALTER TABLE user_profiles');
  });
});
