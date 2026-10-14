import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { initDb, pool } from './db';
import { CfError, getInfo, getRatingHistory, getSubmissions } from './cf';
import { firstAccepted, profileStats, toProblem, weekStart } from './stats';

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const HANDLE_RE = /^[A-Za-z0-9_.-]{3,24}$/;
const MAX_FRIENDS = 25;

const validHandle = (h: unknown): string => {
  if (typeof h !== 'string' || !HANDLE_RE.test(h.trim())) throw new HttpError(400, 'Enter a valid Codeforces handle.');
  return h.trim();
};

async function requireOwner(handle: string): Promise<string> {
  const { rows } = await pool.query('SELECT handle FROM users WHERE lower(handle) = lower($1)', [handle]);
  if (!rows[0]) throw new HttpError(404, 'Unknown user. Sign in with your handle first.');
  return rows[0].handle;
}

const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// "Sign in": confirm the handle exists on Codeforces and remember it.
app.post('/api/session', wrap(async (req, res) => {
  const info = await getInfo(validHandle(req.body?.handle));
  await pool.query('INSERT INTO users (handle) VALUES ($1) ON CONFLICT DO NOTHING', [info.handle]);
  res.json(info);
}));

app.get('/api/profile/:handle', wrap(async (req, res) => {
  const handle = validHandle(req.params.handle);
  const info = await getInfo(handle);
  const [ratingHistory, subs] = await Promise.all([getRatingHistory(info.handle), getSubmissions(info.handle)]);
  res.json({ info, ratingHistory, ...profileStats(subs) });
}));

app.post('/api/friends/:owner', wrap(async (req, res) => {
  const owner = await requireOwner(req.params.owner);
  const info = await getInfo(validHandle(req.body?.handle));
  if (info.handle.toLowerCase() === owner.toLowerCase()) throw new HttpError(400, 'You are already on your own leaderboard.');
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM friendships WHERE owner = $1', [owner]);
  if (rows[0].n >= MAX_FRIENDS) throw new HttpError(400, `You can track up to ${MAX_FRIENDS} friends.`);
  await pool.query('INSERT INTO friendships (owner, friend) VALUES ($1, $2) ON CONFLICT DO NOTHING', [owner, info.handle]);
  res.status(201).json(info);
}));

app.delete('/api/friends/:owner/:friend', wrap(async (req, res) => {
  const owner = await requireOwner(req.params.owner);
  await pool.query('DELETE FROM friendships WHERE owner = $1 AND lower(friend) = lower($2)', [owner, req.params.friend]);
  res.status(204).end();
}));

app.get('/api/leaderboard/:owner', wrap(async (req, res) => {
  const owner = await requireOwner(req.params.owner);
  const { rows } = await pool.query('SELECT friend FROM friendships WHERE owner = $1 ORDER BY created_at', [owner]);
  const handles: string[] = [owner, ...rows.map((r) => r.friend)];
  const start = weekStart();

  const entries = [];
  for (const h of handles) {
    const isSelf = h === owner;
    try {
      const [info, subs] = await Promise.all([getInfo(h), getSubmissions(h)]);
      const problems = firstAccepted(subs).filter((s) => s.t >= start).sort((a, b) => b.t - a.t).map(toProblem);
      entries.push({ info, isSelf, count: problems.length, points: problems.reduce((a, p) => a + (p.rating ?? 0), 0), problems });
    } catch (e) {
      entries.push({ info: { handle: h }, isSelf, count: 0, points: 0, problems: [], error: (e as Error).message });
    }
  }
  entries.sort((a, b) => b.count - a.count || b.points - a.points);
  res.json({ weekStart: start, entries });
}));

// Serve the built React app in production.
const clientDir = path.join(__dirname, '../client');
app.use(express.static(clientDir));
app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError || err instanceof CfError ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Something went wrong on the server.' : err.message });
});

const port = Number(process.env.PORT ?? 3001);
initDb()
  .then(() => app.listen(port, () => console.log(`CP Tracker listening on :${port}`)))
  .catch((e) => { console.error('Database setup failed:', e); process.exit(1); });
