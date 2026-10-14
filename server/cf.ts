import { pool } from './db';

const BASE = 'https://codeforces.com/api';
const MIN_INTERVAL = Number(process.env.CF_MIN_INTERVAL_MS ?? 1500);

export class CfError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

// All Codeforces calls go through one queue so we respect their rate limit.
let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastCall + MIN_INTERVAL - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

function cfGet<T>(method: string, params: Record<string, string | number>): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]): [string, string] => [k, String(v)]));
  return throttled(async () => {
    const res = await fetch(`${BASE}/${method}?${qs}`, { signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (!res) throw new CfError('Could not reach Codeforces. Try again in a moment.');
    const body: any = await res.json().catch(() => null);
    if (!body) throw new CfError(`Codeforces sent an invalid response (${res.status}).`);
    if (body.status !== 'OK') {
      const comment = String(body.comment ?? 'Codeforces error');
      throw new CfError(comment, /not found/i.test(comment) ? 404 : 502);
    }
    return body.result as T;
  });
}

// Postgres-backed cache; serves stale data if Codeforces is unavailable.
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const { rows } = await pool.query('SELECT data, fetched_at FROM cf_cache WHERE key = $1', [key]);
  const row = rows[0];
  if (row && Date.now() - new Date(row.fetched_at).getTime() < ttlMs) return row.data as T;
  try {
    const data = await load();
    await pool.query(
      `INSERT INTO cf_cache (key, data, fetched_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, fetched_at = now()`,
      [key, JSON.stringify(data)],
    );
    return data;
  } catch (e) {
    if (row && !(e instanceof CfError && e.status === 404)) return row.data as T;
    throw e;
  }
}

export interface Info { handle: string; rating?: number; maxRating?: number; rank?: string; avatar?: string }
export interface RatingChange { t: number; contest: string; rank: number; oldRating: number; newRating: number }
export interface Sub { t: number; v: string; c?: number; i: string; n: string; r?: number; tags: string[] }

export const getInfo = (handle: string) =>
  cached<Info>(`info:${handle.toLowerCase()}`, 30 * 60e3, async () => {
    const [u] = await cfGet<any[]>('user.info', { handles: handle });
    return { handle: u.handle, rating: u.rating, maxRating: u.maxRating, rank: u.rank, avatar: u.titlePhoto };
  });

export const getRatingHistory = (handle: string) =>
  cached<RatingChange[]>(`rating:${handle.toLowerCase()}`, 15 * 60e3, async () =>
    (await cfGet<any[]>('user.rating', { handle })).map((r) => ({
      t: r.ratingUpdateTimeSeconds, contest: r.contestName, rank: r.rank,
      oldRating: r.oldRating, newRating: r.newRating,
    })),
  );

export const getSubmissions = (handle: string) =>
  cached<Sub[]>(`status:${handle.toLowerCase()}`, 5 * 60e3, async () =>
    (await cfGet<any[]>('user.status', { handle, from: 1, count: 20000 })).map((s) => ({
      t: s.creationTimeSeconds, v: s.verdict ?? 'TESTING', c: s.problem.contestId, i: s.problem.index,
      n: s.problem.name, r: s.problem.rating, tags: s.problem.tags ?? [],
    })),
  );
