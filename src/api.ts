import type { Info, Leaderboard, Profile } from './types';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

const enc = encodeURIComponent;

export const api = {
  session: (handle: string) => req<Info>('/session', { method: 'POST', body: JSON.stringify({ handle }) }),
  profile: (handle: string) => req<Profile>(`/profile/${enc(handle)}`),
  leaderboard: (owner: string) => req<Leaderboard>(`/leaderboard/${enc(owner)}`),
  addFriend: (owner: string, handle: string) =>
    req<Info>(`/friends/${enc(owner)}`, { method: 'POST', body: JSON.stringify({ handle }) }),
  removeFriend: (owner: string, friend: string) =>
    req<void>(`/friends/${enc(owner)}/${enc(friend)}`, { method: 'DELETE' }),
};
