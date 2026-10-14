import { Sub } from './cf';

const key = (s: Sub) => `${s.c}-${s.i}`;

export function problemUrl(s: Sub) {
  if (s.c === undefined) return '#';
  return `https://codeforces.com/${s.c >= 100000 ? 'gym' : 'contest'}/${s.c}/problem/${s.i}`;
}

/** One entry per problem: the earliest accepted submission. */
export function firstAccepted(subs: Sub[]): Sub[] {
  const m = new Map<string, Sub>();
  for (const s of subs) {
    if (s.v !== 'OK') continue;
    const prev = m.get(key(s));
    if (!prev || s.t < prev.t) m.set(key(s), s);
  }
  return [...m.values()];
}

const count = (items: string[]) => {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return [...m].map(([name, n]) => ({ name, count: n })).sort((a, b) => b.count - a.count);
};

export function profileStats(subs: Sub[]) {
  const solved = firstAccepted(subs);
  const buckets = new Map<number, number>();
  let unrated = 0;
  for (const s of solved) {
    if (s.r) {
      const b = Math.floor(s.r / 100) * 100;
      buckets.set(b, (buckets.get(b) ?? 0) + 1);
    } else unrated++;
  }
  return {
    solved: solved.length,
    submissions: subs.length,
    verdicts: count(subs.map((s) => s.v)),
    tags: count(solved.flatMap((s) => s.tags)),
    ratings: [...buckets].map(([bucket, n]) => ({ bucket, count: n })).sort((a, b) => a.bucket - b.bucket),
    unrated,
  };
}

/** Monday 00:00 UTC of the current week, in unix seconds. */
export function weekStart(now = new Date()) {
  const back = (now.getUTCDay() + 6) % 7;
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back) / 1000;
}

export const toProblem = (s: Sub) => ({
  id: key(s), name: s.n, rating: s.r, tags: s.tags, t: s.t, url: problemUrl(s),
});
