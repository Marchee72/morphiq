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
    const tables = ['workout_logs', 'workout_sets', 'food_logs'];
    for (const table of tables) {
      const { rows } = await pool.query(`SELECT pg_relation_filepath($1) as path`, [table]);
      console.log(`${table}: ${rows[0].path}`);
    }
  } catch (err) {
    console.error("Error finding paths:", err);
  } finally {
    await pool.end();
  }
}

run();
