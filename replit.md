# ChessHub

A premium, full-stack chess platform inspired by Chess.com — for playing, learning, and competing online.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at /api)
- `pnpm --filter @workspace/chess-platform run dev` — run the frontend (served at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + Framer Motion + chess.js
- API: Express 5 + Socket.io (planned)
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (jsonwebtoken + bcrypt)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/` — DB tables: users, ratings, games, moves, puzzles, friends, notifications
- `lib/db/src/relations.ts` — Drizzle relations for query builder
- `artifacts/api-server/src/routes/` — Express route handlers: auth, users, games, puzzles, leaderboard, friends
- `artifacts/api-server/src/lib/auth.ts` — JWT middleware
- `artifacts/chess-platform/src/` — React frontend
- `artifacts/chess-platform/src/components/ChessBoard.tsx` — Main chess board component
- `artifacts/chess-platform/src/context/AuthContext.tsx` — Auth state management

## Demo credentials

- Email: `demo@chess.com` / Password: `password`
- Email: `admin@chess.com` / Password: `password`
- Or use "Play as Guest" for instant access

## Architecture decisions

- Contract-first: OpenAPI spec drives both frontend hooks (Orval) and backend Zod validation
- JWT stored in localStorage under `chess_token`, attached as Bearer token to all API calls
- Bot AI uses chess.js move generation with difficulty mapped to randomness (full Stockfish integration can be added)
- Game state is persisted in PostgreSQL after every move (reliable, auditable)
- Drizzle query builder with `with:` for relations (no N+1 queries on game listings)

## Product

ChessHub is a full-featured chess platform where players can:
- **Play chess** vs AI bots (7 difficulty levels), local multiplayer, or online against others
- **Solve puzzles** — daily puzzle, rated tactical puzzles, puzzle streak tracking
- **Analyze games** — move-by-move analysis with accuracy scores and classifications
- **Compete** — ELO ratings for Bullet/Blitz/Rapid/Classical, global leaderboard
- **Connect** — friend system, friend requests, online status

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after any change to `openapi.yaml`
- Run `pnpm --filter @workspace/db run push` after schema changes
- `bcrypt` requires native binaries — run `pnpm approve-builds` if build warnings appear
- The bot user (username: "ChessBot") must exist in the DB for bot games to work

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
