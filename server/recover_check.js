import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'morphiq',
  user: process.env.DB_USER || 'morphiq',
  password: process.env.DB_PASSWORD || 'morphiq_secret_2024',
});

async function run() {
  try {
    console.log('--- DB Profiles ---');
    const { rows: profiles } = await pool.query('SELECT * FROM user_profiles');
    console.log(`Found ${profiles.length} profiles.`);
    
    console.log('\n--- Distinct profileIds in other tables ---');
    const tables = ['measurements', 'workout_logs', 'food_logs', 'messages', 'workout_sets', 'user_exercises'];
    const profileIdsInTables = {};
    
    for (const table of tables) {
      try {
        const { rows } = await pool.query(`SELECT DISTINCT "profileId" FROM ${table}`);
        const ids = rows.map(r => r.profileId);
        profileIdsInTables[table] = ids;
        console.log(`Table '${table}' profileIds:`, ids);
      } catch (err) {
        console.log(`Error reading table '${table}':`, err.message);
      }
    }
    
    const allProfileIds = new Set(profiles.map(p => p.id.toString()));
    console.log('\nAll profile IDs in user_profiles:', Array.from(allProfileIds));
    
    // Find orphaned IDs
    const orphanedIds = new Set();
    for (const [table, ids] of Object.entries(profileIdsInTables)) {
      for (const id of ids) {
        if (!allProfileIds.has(id.toString())) {
          orphanedIds.add(id);
          console.log(`Found orphaned profileId '${id}' in table '${table}'`);
        }
      }
    }
    
    if (orphanedIds.size > 0) {
      console.log('\nOrphaned Profile IDs found:', Array.from(orphanedIds));
      for (const id of orphanedIds) {
        console.log(`\n--- Orphaned Data for profile ID ${id} ---`);
        for (const table of tables) {
          const { rows } = await pool.query(`SELECT * FROM ${table} WHERE "profileId" = $1`, [id]);
          console.log(`  Table '${table}': ${rows.length} rows`);
          if (rows.length > 0) {
            console.log(rows.slice(0, 3)); // show first 3
          }
        }
      }
    } else {
      console.log('\nNo orphaned profile IDs found.');
    }
  } catch (err) {
    console.error('Error running check:', err);
  } finally {
    await pool.end();
  }
}

run();
