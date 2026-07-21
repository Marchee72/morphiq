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
    const query = `
      SELECT 
        c.relname as table_name,
        a.attname as column_name,
        t.typname as type_name,
        a.attnum
      FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      JOIN pg_type t ON a.atttypid = t.oid
      WHERE n.nspname = 'public' 
        AND c.relkind = 'r'
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY c.relname, a.attnum;
    `;
    const { rows } = await pool.query(query);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error("Error getting columns:", err);
  } finally {
    await pool.end();
  }
}

run();
