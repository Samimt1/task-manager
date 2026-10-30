import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { validateTask } from '../src/validation.js';

const task = { title: 'Prepare presentation', description: 'CRUD demonstration', status: 'Pending', priority: 'High', due_date: '2026-11-05' };

test('validation rejects blank titles, invalid enums and impossible dates', () => {
  assert.deepEqual(validateTask(task), {});
  for (const date of ['2026-02-30', 'not-a-date', '2026-13-01', '0000-01-01']) {
    assert.ok(validateTask({ ...task, due_date: date }).due_date);
  }
  const errors = validateTask({ ...task, title: ' ', status: 'Unknown', priority: 'Urgent' });
  assert.ok(errors.title && errors.status && errors.priority);
});

test('CRUD routes, filters, parameter binding and error responses', async (t) => {
  let stored;
  let lastQuery;
  const db = { async query(sql, params) {
    lastQuery = { sql, params };
    if (sql.startsWith('INSERT')) { stored = { id: 1, ...task, title: params[0] }; return { rows: [stored] }; }
    if (sql.startsWith('UPDATE')) { if (!stored) return { rows: [] }; stored = { ...stored, title: params[0], status: params[2] }; return { rows: [stored] }; }
    if (sql.startsWith('DELETE')) { const rows = stored ? [{ id: 1 }] : []; stored = undefined; return { rows }; }
    return { rows: stored ? [stored] : [] };
  } };
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/tasks`;
  const send = (method, body, suffix = '') => fetch(`${base}${suffix}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal((await send('POST', { ...task, title: '' })).status, 400);
  const created = await send('POST', task);
  assert.equal(created.status, 201);
  assert.equal((await created.json()).id, 1);
  assert.equal((await fetch(`${base}/1`)).status, 200);
  const search = "'; DROP TABLE tasks; --";
  const list = await fetch(`${base}?status=Pending&search=${encodeURIComponent(search)}`);
  assert.equal(list.status, 200);
  assert.deepEqual(lastQuery.params, ['Pending', `%${search}%`]);
  assert.ok(!lastQuery.sql.includes(search));
  const updated = await send('PUT', { ...task, status: 'Completed' }, '/1');
  assert.equal((await updated.json()).status, 'Completed');
  assert.equal((await send('DELETE', undefined, '/1')).status, 204);
  assert.equal((await fetch(`${base}/1`)).status, 404);
  assert.equal((await send('PUT', task, '/1')).status, 404);
  assert.equal((await send('DELETE', undefined, '/1')).status, 404);
  assert.equal((await fetch(`${base}/invalid`)).status, 400);
  assert.equal((await fetch(`${base}?status=Unknown`)).status, 400);
  const malformed = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
});

test('database failures return a generic API error', async (t) => {
  const server = createApp({ query: async () => { throw new Error('Database unavailable'); } }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/tasks`);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { message: 'Unable to complete the request. Please try again.' });
});
