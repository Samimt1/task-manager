
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Validate environment variables
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is missing. Please check your .env file.'
  );
}

// Create PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Handle unexpected database connection errors
pool.on('error', (error) => {
  console.error(
    'Unexpected database connection error:',
    error.message
  );
});

// Test database connection
export async function connectDB() {
  try {
    const client = await pool.connect();

    try {
      const result = await client.query('SELECT NOW() AS current_time');

      console.log('PostgreSQL connected successfully');
      console.log('Database time:', result.rows[0].current_time);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('PostgreSQL connection failed:', error.message);
    throw error;
  }
}
