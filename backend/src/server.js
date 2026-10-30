import { pool } from './db.js';
import { createApp } from './app.js';

const port = process.env.PORT || 4000;
const server = createApp(pool).listen(port, () => console.log(`API running at http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(async () => { await pool.end(); process.exit(0); }));
}
