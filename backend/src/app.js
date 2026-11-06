import express from 'express';
import cors from 'cors';
import { statuses, validateTask } from './validation.js';


export function createApp(db) {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
  app.use(express.json({ limit: '32kb' }));
  const columns = "id, title, description, status, priority, to_char(due_date, 'YYYY-MM-DD') AS due_date, created_at, updated_at";

  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  });
  app.get('/api/tasks', async (req, res) => {
    const { status, search = '' } = req.query;
    if (typeof search !== 'string' || search.length > 200 || (status !== undefined && !statuses.includes(status)))
      return res.status(400).json({ message: 'Invalid search or status filter.' });
    const result = await db.query(
      `SELECT ${columns} FROM tasks WHERE ($1::text IS NULL OR status = $1)
       AND (title ILIKE $2 OR description ILIKE $2) ORDER BY created_at DESC, id DESC`,
      [status ?? null, `%${search}%`]
    );
    res.json(result.rows);
  });
  app.param('id', (req, res, next, id) => {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) > 2147483647)
      return res.status(400).json({ message: 'Invalid task ID.' });
    next();
  });
  app.get('/api/tasks/:id', async (req, res) => {
    const result = await db.query(`SELECT ${columns} FROM tasks WHERE id = $1`, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Task not found.' });
    res.json(result.rows[0]);
  });
  async function saveTask(req, res) {
    const errors = validateTask(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please check the form.', errors });
    const { title, description, status, priority, due_date } = req.body;
    const values = [title.trim(), description.trim(), status, priority, due_date];
    const updating = req.method === 'PUT';
    const sql = updating
      ? `UPDATE tasks SET title=$1, description=$2, status=$3, priority=$4, due_date=$5, updated_at=NOW() WHERE id=$6 RETURNING ${columns}`
      : `INSERT INTO tasks (title, description, status, priority, due_date) VALUES ($1,$2,$3,$4,$5) RETURNING ${columns}`;
    if (updating) values.push(req.params.id);
    const result = await db.query(sql, values);
    if (!result.rows.length) return res.status(404).json({ message: 'Task not found.' });
    res.status(updating ? 200 : 201).json(result.rows[0]);
  }
  app.post('/api/tasks', saveTask);
  app.put('/api/tasks/:id', saveTask);
  app.delete('/api/tasks/:id', async (req, res) => {
    const result = await db.query('DELETE FROM tasks WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Task not found.' });
    res.status(204).end();
  });
  app.use((_req, res) => res.status(404).json({ message: 'Endpoint not found.' }));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request body is too large.' });
    console.error(error.message);
    res.status(500).json({ message: 'Unable to complete the request. Please try again.' });
  });
  return app;
}
