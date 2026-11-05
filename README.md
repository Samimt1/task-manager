# Task Manager

A CRUD project with a Next.js App Router frontend, a separate Node.js + Express REST API, and PostgreSQL persistence. No authentication is included in this first version; run it locally for the submission demonstration.

## 1. Prerequisites

Install Node.js 20.9 or newer (Node.js 24 recommended), npm, and PostgreSQL. Start your PostgreSQL service. Commands below run from the repository root in PowerShell. `npm.cmd` avoids Windows PowerShell execution policy issues; on macOS/Linux use `npm` instead.

## 2. Install dependencies

```powershell
npm.cmd install
```

## 3. Create the database

In pgAdmin's Query Tool connected to the default `postgres` database, run:

```sql
CREATE DATABASE task_manager;
```

Alternatively, if PostgreSQL command-line tools are on PATH

```powershell
psql -U postgres -c "CREATE DATABASE task_manager;"
```

## 4. Configure environment files

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.local.example frontend/.env.local
```

Edit `backend/.env` to match your local PostgreSQL username, password, host, and port:

```dotenv
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/task_manager
FRONTEND_URL=http://localhost:3000
```

URL-encode special characters in the database username/password. The frontend environment file should contain:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Never commit real environment files. Restart the corresponding development server after environment changes.

## 5. Create the tasks table

```powershell
npm.cmd run db:setup
```

This applies `backend/schema.sql` without dropping existing tasks. The database itself must already exist. It is safe to rerun for the initial schema; changes to existing table definitions would need a migration.

## 6. Start the backend

```powershell
npm.cmd run dev:backend
```

Keep this terminal open. `http://localhost:4000/api/health` should return `{"status":"ok"}` when PostgreSQL is reachable.

## 7. Start the frontend

Open a second terminal in the repository root:

```powershell
npm.cmd run dev:frontend
```

Visit **http://localhost:3000**.

## 8. Demonstrate CRUD

1. Click **Add Task** and enter a title, optional description, status, priority, and required due date.
2. Save and see the task card. Click **View details** to load its details from the API.
3. Click **Edit**, change its contents or status, and save.
4. Search by title/description or select a status tab. Overview numbers describe the currently matching tasks.
5. Click **Delete** and confirm the deletion. Cancel leaves the task unchanged.
6. Refresh the browser to show that tasks persist in PostgreSQL.

Client forms validate required fields and length limits. The API independently validates titles, descriptions, status/priority values and real calendar dates. Past due dates are allowed. Requests use parameterized SQL. Loading, empty, success and error states are included, along with responsive cards and native modal dialogs.

## 9. Run checks

```powershell
npm.cmd test
npm.cmd run build
```

Tests cover validation, CRUD API responses, missing tasks, invalid IDs, malformed JSON, parameter binding, and database error handling. API tests use an injected test database adapter; they do not replace a live PostgreSQL integration check. Use the demonstration steps above against PostgreSQL to verify persistence.

For production frontend mode after building:

```powershell
npm.cmd run start --workspace frontend
```

Backend production command: `npm.cmd run start --workspace backend`.

## Code walkthrough

| File | Responsibility |
| --- | --- |
| `backend/schema.sql` | PostgreSQL table and constraints |
| `backend/src/db.js` | PostgreSQL connection pool |
| `backend/src/setup.js` | Table setup script |
| `backend/src/validation.js` | Input validation |
| `backend/src/app.js` | Express CRUD routes and errors |
| `backend/src/server.js` | HTTP server and shutdown |
| `backend/test/api.test.js` | Automated API and validation checks |
| `frontend/app/layout.js` | Root layout and metadata |
| `frontend/app/page.js` | Task list, search/filter, forms, details and confirmation |
| `frontend/app/globals.css` | Responsive styles |

## REST API

| Method | Route | Result |
| --- | --- | --- |
| GET | `/api/health` | Database connectivity check |
| GET | `/api/tasks?status=Pending&search=presentation` | Filtered list; both query parameters optional |
| GET | `/api/tasks/:id` | One task |
| POST | `/api/tasks` | Create task, returns 201 |
| PUT | `/api/tasks/:id` | Replace editable fields, returns 200 |
| DELETE | `/api/tasks/:id` | Delete task, returns 204 |

POST and PUT accept the complete editable task object:

```json
{
  "title": "Prepare interview presentation",
  "description": "Explain the CRUD routes and demonstrate the application.",
  "status": "Pending",
  "priority": "High",
  "due_date": "2026-11-05"
}
```

Statuses: `Pending`, `In Progress`, `Completed`. Priorities: `Low`, `Medium`, `High`. Dates use `YYYY-MM-DD`. IDs and timestamps are generated by the database. Invalid requests return 400, missing tasks return 404, and unexpected server/database failures return 500 with a generic message.

## Troubleshooting

- **Cannot reach the API:** Start the backend and check `NEXT_PUBLIC_API_URL`.
- **Database error:** Verify PostgreSQL is running, update `DATABASE_URL`, create the database, and run `db:setup`.
- **CORS error:** Match `FRONTEND_URL` to the browser origin, including its port.
- **Port 3000 busy:** Stop the other application or configure the actual frontend origin in `FRONTEND_URL`.
- **PowerShell script execution error:** Use `npm.cmd` instead of `npm`; no execution policy change is needed.

Before exposing this application publicly, add the authentication and authorization required for your users. This version deliberately implements the requested local CRUD scope.
