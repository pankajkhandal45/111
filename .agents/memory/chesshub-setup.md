---
name: ChessHub setup
description: Key facts about the ChessHub chess platform project — DB, build, and known bugs
---

## Database
- Uses **libsql/SQLite** (file `sqlite.db` at workspace root), NOT PostgreSQL
- `DATABASE_URL` env var is set to a PostgreSQL URL — the db package now detects this and falls back to `file:../../sqlite.db`
- Both `lib/db/src/index.ts` and `lib/db/drizzle.config.ts` have the URL-detection guard

## Build
- API server: esbuild bundles to `dist/index.mjs`; `pnpm-workspace.yaml` must have `allowBuilds: bcrypt: true, esbuild: true`
- Frontend: Vite on port from PORT env; no additional build step in dev

## Architecture
- SSE (not WebSockets) for real-time game updates — clients reconnect every 3s on error
- Bot move runs in `setImmediate` (non-blocking); reloads game state before writing to avoid stale overwrites
- Auth middleware supports token via query param for SSE (EventSource can't send headers)

## Replit proxy path stripping (CRITICAL)
- Replit's path router strips the artifact prefix before forwarding to the service port
- API server artifact has previewPath `/api` → browser sends `/api/auth/login` → Replit strips → server gets `/auth/login`
- **Fix applied:** `app.use("/", router)` in `app.ts` (NOT `/api`); Vite dev proxy also rewrites to strip `/api` prefix
- **Why:** Without this, ALL API calls from the browser silently 404 because the router mount path doesn't match

**Why:** These were non-obvious configuration/design decisions that caused hours of debugging on first setup.
