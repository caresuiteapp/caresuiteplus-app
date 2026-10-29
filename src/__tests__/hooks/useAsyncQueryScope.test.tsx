// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';

vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 60_000, useLiveRefresh: () => ({ isLiveConnected: false }) }));

type Snapshot = { scope: string; data: unknown; loading: boolean; error: string | null; refreshError: string | null; fromCache: boolean; isEmpty: boolean };
let root: Root, host: HTMLDivElement, snapshots: Snapshot[];
const pending = () => new Promise<{ ok: true; data: string }>(() => {});
function Probe({ scope, enabled = true, fetcher = pending }: { scope: string; enabled?: boolean; fetcher?: () => Promise<any> }) {
  const query = useAsyncQuery<string>(fetcher, [scope], { queryKey: scope, enabled });
  snapshots.push({ scope, data: query.data, loading: query.loading, error: query.error, refreshError: query.refreshError, fromCache: query.cacheMeta.fromCache, isEmpty: query.isEmpty });
  return <div>{query.loading ? 'Laden' : query.error ?? query.data}</div>;
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; snapshots = [];
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('query scope publication before queued React state resets', () => {
  it('never reports a newly enabled identity as already finished loading', async () => {
    await act(async () => root.render(<Probe scope="unlinked" enabled={false} />));
    await act(async () => root.render(<Probe scope="employee-b" />));
    const next = snapshots.filter(row => row.scope === 'employee-b');
    expect(next.length).toBeGreaterThan(0);
    expect(next.every(row => row.data === null && row.loading && !row.error && !row.isEmpty)).toBe(true);
  });

  it('never publishes the prior account data or cache metadata under the new identity', async () => {
    const first = async () => ({ ok: true as const, data: 'Nur Konto A', fromCache: true, cachedAt: '2026-10-29T06:00:00Z' });
    await act(async () => root.render(<Probe scope="employee-a" fetcher={first} />));
    expect(host.textContent).toBe('Nur Konto A');
    await act(async () => root.render(<Probe scope="employee-b" />));
    const next = snapshots.filter(row => row.scope === 'employee-b');
    expect(next.length).toBeGreaterThan(0);
    expect(next.every(row => row.data === null && row.loading && !row.fromCache && !row.error)).toBe(true);
    expect(host.textContent).toBe('Laden');
  });
});
