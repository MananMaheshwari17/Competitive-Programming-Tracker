# CP Tracker

Codeforces tracker: profile stats, friend leaderboard, weekly solved problems.
React + TypeScript (Vite) · Node.js + Express · PostgreSQL.

## Run locally
1. Node 20+ and a Postgres database. Quick option: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cptracker postgres:16`
2. `cp .env.example .env` and adjust `DATABASE_URL`.
3. `npm install && npm run dev` — app on http://localhost:5173, API on :3001. Tables are created on startup.

## Deploy on Render
Push to GitHub, then **New → Blueprint** and select the repo. `render.yaml` creates the web service and a Postgres database and wires `DATABASE_URL`. The Express server serves the built React app, so it is a single service.
(Railway: add a Postgres plugin, set build `npm install --include=dev && npm run build`, start `npm start`.)

## How it works
- **Identity:** no passwords. You enter a Codeforces handle (validated against the API); it is saved in the browser and in the `users` table. Friends are stored per handle in `friendships`. Anyone who knows a handle can edit that handle's friend list, which is the trade-off of having no login.
- **Codeforces API:** all calls go through one queue (`CF_MIN_INTERVAL_MS`, default 1.5s) and are cached in `cf_cache` (info 30 min, rating 15 min, submissions 5 min). Stale data is served if Codeforces is down.
- **Weekly leaderboard:** a problem counts when its first accepted submission falls in the current week (Monday 00:00 UTC onward). Ties are broken by the sum of solved problem ratings.

## API
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/session` `{handle}` | Validate and register handle |
| GET | `/api/profile/:handle` | Rating history, verdicts, tags, rating buckets |
| GET | `/api/leaderboard/:owner` | Weekly standings with solved problems |
| POST | `/api/friends/:owner` `{handle}` | Add friend |
| DELETE | `/api/friends/:owner/:friend` | Remove friend |
