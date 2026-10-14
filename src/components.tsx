import type { Count, RatingChange } from './types';

export function ratingColor(r?: number) {
  if (r === undefined) return 'var(--text)';
  if (r < 1200) return '#9aa0a6';
  if (r < 1400) return '#4cc26b';
  if (r < 1600) return '#2ec4b6';
  if (r < 1900) return '#5b9cff';
  if (r < 2100) return '#b685ff';
  if (r < 2400) return '#ff9f43';
  return '#ff5c5c';
}

export function verdictLabel(v: string) {
  if (v === 'OK') return 'Accepted';
  const s = v.toLowerCase().replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function Handle({ handle, rating }: { handle: string; rating?: number }) {
  return <span style={{ color: ratingColor(rating), fontWeight: 600 }}>{handle}</span>;
}

export function BarList({ items, empty = 'Nothing to show yet.' }: { items: Count[]; empty?: string }) {
  if (items.length === 0) return <p className="muted">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="bars">
      {items.map((i) => (
        <li key={i.name}>
          <span className="bar-label" title={i.name}>{i.name}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${(i.count / max) * 100}%` }} /></span>
          <span className="bar-count">{i.count}</span>
        </li>
      ))}
    </ul>
  );
}

export function RatingChart({ history }: { history: RatingChange[] }) {
  if (history.length === 0) return <p className="muted">No rated contests yet.</p>;
  const W = 760, H = 240, P = { l: 44, r: 12, t: 12, b: 26 };
  const ts = history.map((h) => h.t);
  const rs = history.map((h) => h.newRating);
  const minT = Math.min(...ts), maxT = Math.max(...ts);
  const lo = Math.floor((Math.min(...rs) - 50) / 100) * 100;
  const hi = Math.ceil((Math.max(...rs) + 50) / 100) * 100;
  const x = (t: number) => P.l + (maxT === minT ? 0.5 : (t - minT) / (maxT - minT)) * (W - P.l - P.r);
  const y = (r: number) => P.t + (1 - (r - lo) / (hi - lo)) * (H - P.t - P.b);
  const step = Math.max(100, Math.ceil((hi - lo) / 5 / 100) * 100);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const year = (t: number) => new Date(t * 1000).getFullYear();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Rating over time">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="grid" />
          <text x={P.l - 8} y={y(v) + 4} textAnchor="end" className="axis">{v}</text>
        </g>
      ))}
      <text x={P.l} y={H - 6} className="axis">{year(minT)}</text>
      <text x={W - P.r} y={H - 6} textAnchor="end" className="axis">{year(maxT)}</text>
      <polyline fill="none" className="line" points={history.map((h) => `${x(h.t)},${y(h.newRating)}`).join(' ')} />
      {history.map((h) => (
        <circle key={h.t} cx={x(h.t)} cy={y(h.newRating)} r={3} className="dot">
          <title>{`${h.contest}\nRank ${h.rank}, ${h.oldRating} → ${h.newRating}`}</title>
        </circle>
      ))}
    </svg>
  );
}
