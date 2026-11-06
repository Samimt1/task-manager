
import express from 'express';
import cors from 'cors';
import { statuses, validateTask } from './validation.js';

export function createApp(db) {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    })
  );

  app.use(express.json({ limit: '32kb' }));

  // Database columns
  const taskColumns = `
    id,
    title,
    description,
    status,
    priority,
    TO_CHAR(due_date, 'YYYY-MM-DD') AS due_date,
    created_at,
    updated_at
  `;

  // Async error handling
  const asyncHandler = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

  // Health check
  app.get(
    '/api/health',
    asyncHandler(async (req, res) => {
      await db.query('SELECT 1');

      res.status(200).json({
        status: 'ok',
        message: 'Server is running successfully',
      });
    })
  );

  // GET all tasks with filtering and searching
  app.get(
    '/api/tasks',
    asyncHandler(async (req, res) => {
      const { status, search = '' } = req.query;

      if (
        typeof search !== 'string' ||
        search.length > 200 ||
        (status !== undefined && !statuses.includes(status))
      ) {
        return res.status(400).json({
          message: 'Invalid search or status filter.',
        });
      }

      const query = `
        SELECT ${taskColumns}
        FROM tasks
        WHERE ($1::text IS NULL OR status = $1)
          AND (
            title ILIKE $2
            OR COALESCE(description, '') ILIKE $2
          )
        ORDER BY created_at DESC, id DESC
      `;

      const values = [status ?? null, `%${search}%`];

      const result = await db.query(query, values);

      return res.status(200).json(result.rows);
    })
  );

  // Validate task ID
  app.param('id', (req, res, next, id) => {
    const taskId = Number(id);

    if (
      !/^[1-9]\d*$/.test(id) ||
      !Number.isSafeInteger(taskId) ||
      taskId > 2147483647
    ) {
      return res.status(400).json({
        message: 'Invalid task ID.',
      });
    }

    next();
  });

  // GET single task
  app.get(
    '/api/tasks/:id',
    asyncHandler(async (req, res) => {
      const query = `
        SELECT ${taskColumns}
        FROM tasks
        WHERE id = $1
      `;

      const result = await db.query(query, [req.params.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Task not found.',
        });
      }

      return res.status(200).json(result.rows[0]);
    })
  );

  // Reusable CREATE and UPDATE handler
  const saveTask = asyncHandler(async (req, res) => {
    const errors = validateTask(req.body);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: 'Please check the form.',
        errors,
      });
    }

    const {
      title,
      description,
      status,
      priority,
      due_date,
    } = req.body;

    const values = [
      title.trim(),
      description.trim(),
      status,
      priority,
      due_date || null,
    ];

    const isUpdating = req.method === 'PUT';

    let query;

    if (isUpdating) {
      query = `
        UPDATE tasks
        SET
          title = $1,
          description = $2,
          status = $3,
          priority = $4,
          due_date = $5,
          updated_at = NOW()
        WHERE id = $6
        RETURNING ${taskColumns}
      `;

      values.push(req.params.id);
    } else {
      query = `
        INSERT INTO tasks (
          title,
          description,
          status,
          priority,
          due_date
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING ${taskColumns}
      `;
    }

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Task not found.',
      });
    }

    return res.status(isUpdating ? 200 : 201).json(
      result.rows[0]
    );
  });

  // CREATE task
  app.post('/api/tasks', saveTask);

  // UPDATE task
  app.put('/api/tasks/:id', saveTask);

  // DELETE task
  app.delete(
    '/api/tasks/:id',
    asyncHandler(async (req, res) => {
      const query = `
        DELETE FROM tasks
        WHERE id = $1
        RETURNING id
      `;

      const result = await db.query(query, [req.params.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: 'Task not found.',
        });
      }

      return res.status(204).end();
    })
  );

  // Handle unknown routes
  app.use((req, res) => {
    return res.status(404).json({
      message: 'Endpoint not found.',
    });
  });

  // Global error handler
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({
        message: 'Invalid JSON body.',
      });
    }

    if (error.type === 'entity.too.large') {
      return res.status(413).json({
        message: 'Request body is too large.',
      });
    }

    console.error('API Error:', error);

    return res.status(500).json({
      message: 'Unable to complete the request. Please try again.',
    });
  });

  return app;
}
