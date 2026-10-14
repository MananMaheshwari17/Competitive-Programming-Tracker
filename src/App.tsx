import { FormEvent, Fragment, useEffect, useState } from 'react';
import { api } from './api';
import { BarList, Handle, RatingChart, verdictLabel } from './components';
import type { Leaderboard, Profile } from './types';

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, loading: true }));
    fn()
      .then((data) => alive && setState({ data, loading: false }))
      .catch((e: Error) => alive && setState({ loading: false, error: e.message }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function HandleForm(props: { initial?: string; label: string; action: string; onSubmit: (h: string) => Promise<void> | void }) {
  const [value, setValue] = useState(props.initial ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true); setError('');
    try { await props.onSubmit(value.trim()); } catch (err) { setError((err as Error).message); }
    setBusy(false);
  };
  return (
    <form className="row" onSubmit={submit}>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Codeforces handle" aria-label={props.label} />
      <button className="btn" disabled={busy}>{busy ? 'Checking…' : props.action}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

export default function App() {
  const [handle, setHandle] = useState<string | null>(() => localStorage.getItem('cp-handle'));
  const [tab, setTab] = useState<'profile' | 'friends'>('profile');

  if (!handle) {
    return (
      <div className="login">
        <h1>CP Tracker</h1>
        <p className="muted">Enter your Codeforces handle to see your stats and compete with friends.</p>
        <HandleForm label="Your handle" action="Continue" onSubmit={async (h) => {
          const info = await api.session(h);
          localStorage.setItem('cp-handle', info.handle);
          setHandle(info.handle);
        }} />
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <strong className="brand">CP Tracker</strong>
        <nav>
          <button className={tab === 'profile' ? 'tab active' : 'tab'} onClick={() => setTab('profile')}>Profile</button>
          <button className={tab === 'friends' ? 'tab active' : 'tab'} onClick={() => setTab('friends')}>Friends</button>
        </nav>
        <span className="spacer" />
        <span className="muted">{handle}</span>
        <button className="btn secondary" onClick={() => { localStorage.removeItem('cp-handle'); setHandle(null); }}>Switch user</button>
      </header>
      <main>{tab === 'profile' ? <ProfileView owner={handle} /> : <FriendsView owner={handle} />}</main>
    </div>
  );
}

function ProfileView({ owner }: { owner: string }) {
  const [query, setQuery] = useState(owner);
  const { data: p, error, loading } = useAsync<Profile>(() => api.profile(query), [query]);

  return (
    <>
      <HandleForm key={owner} initial={query} label="Look up a handle" action="View profile" onSubmit={(h) => setQuery(h)} />
      {error && <p className="error">{error}</p>}
      {loading && !p && <p className="muted">Loading profile…</p>}
      {p && (
        <div className={loading ? 'dim' : undefined}>
          <section className="summary">
            <div>
              <h2><Handle handle={p.info.handle} rating={p.info.rating} /></h2>
              <p className="muted">{p.info.rank ?? 'Unrated'}</p>
            </div>
            <dl>
              <div><dt>Rating</dt><dd style={{ color: undefined }}>{p.info.rating ?? '—'}</dd></div>
              <div><dt>Max rating</dt><dd>{p.info.maxRating ?? '—'}</dd></div>
              <div><dt>Problems solved</dt><dd>{p.solved}</dd></div>
              <div><dt>Submissions</dt><dd>{p.submissions}</dd></div>
            </dl>
          </section>

          <section className="panel">
            <h3>Rating history</h3>
            <RatingChart history={p.ratingHistory} />
          </section>

          <div className="grid">
            <section className="panel">
              <h3>Verdicts</h3>
              <BarList items={p.verdicts.slice(0, 8).map((v) => ({ name: verdictLabel(v.name), count: v.count }))} />
            </section>
            <section className="panel">
              <h3>Solved by problem rating</h3>
              <BarList items={[
                ...p.ratings.map((r) => ({ name: String(r.bucket), count: r.count })),
                ...(p.unrated ? [{ name: 'Unrated', count: p.unrated }] : []),
              ]} />
            </section>
            <section className="panel">
              <h3>Solved by topic</h3>
              <BarList items={p.tags.slice(0, 12)} />
            </section>
          </div>
        </div>
      )}
    </>
  );
}

function FriendsView({ owner }: { owner: string }) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, loading } = useAsync<Leaderboard>(() => api.leaderboard(owner), [owner, tick]);
  const reload = () => setTick((t) => t + 1);
  const weekLabel = data
    ? new Date(data.weekStart * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
    : '';

  return (
    <>
      <HandleForm label="Friend's handle" action="Add friend" onSubmit={async (h) => { await api.addFriend(owner, h); reload(); }} />
      <section className="panel">
        <div className="panel-head">
          <h3>Weekly leaderboard</h3>
          {data && <span className="muted">Week of {weekLabel} (UTC). Resets Monday.</span>}
        </div>
        {error && <p className="error">{error}</p>}
        {loading && !data && <p className="muted">Loading. The first load can take a few seconds because Codeforces limits requests.</p>}
        {data && (
          <div className="leaderboard-scroll">
            <table className={`leaderboard-table${loading ? ' dim' : ''}`}>
              <thead>
                <tr><th>#</th><th>Handle</th><th className="num">Solved</th><th className="num">Rating points</th><th /></tr>
              </thead>
              <tbody>
                {data.entries.map((e, idx) => {
                  const isOpen = open === e.info.handle;
                  return (
                    <Fragment key={e.info.handle}>
                      <tr className="clickable" onClick={() => setOpen(isOpen ? null : e.info.handle)}>
                        <td>{idx + 1}</td>
                        <td>
                          <button className="link" aria-expanded={isOpen}>{isOpen ? '▾' : '▸'}</button>{' '}
                          <Handle handle={e.info.handle} rating={e.info.rating} />
                          {e.isSelf && <span className="muted"> (you)</span>}
                          {e.error && <span className="error"> {e.error}</span>}
                        </td>
                        <td className="num">{e.count}</td>
                        <td className="num">{e.points}</td>
                        <td className="num">
                          {!e.isSelf && (
                            <button className="btn secondary small" onClick={async (ev) => {
                              ev.stopPropagation();
                              await api.removeFriend(owner, e.info.handle);
                              reload();
                            }}>Remove</button>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td />
                          <td colSpan={4}>
                            {e.problems.length === 0 ? (
                              <p className="muted">No problems solved this week.</p>
                            ) : (
                              <ul className="problems">
                                {e.problems.map((pr) => (
                                  <li key={pr.id}>
                                    <a href={pr.url} target="_blank" rel="noreferrer">{pr.name}</a>
                                    <span className="muted">{pr.rating ?? 'Unrated'}</span>
                                    <span className="tags">{pr.tags.map((t) => <span key={t} className="tag">{t}</span>)}</span>
                                    <span className="muted">{new Date(pr.t * 1000).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && data.entries.length === 1 && <p className="muted">Add a friend's handle above to start comparing.</p>}
      </section>
    </>
  );
}
