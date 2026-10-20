// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { appStateListeners } = vi.hoisted(() => ({ appStateListeners: new Set<(state: string) => void>() }));
vi.mock('react-native', () => ({ AppState: {
  addEventListener: (_event: string, listener: (state: string) => void) => {
    appStateListeners.add(listener);
    return { remove: () => appStateListeners.delete(listener) };
  },
} }));
import { useWorkflowWaitState } from '@/hooks/useWorkflowWaitState';

let root: Root;
let host: HTMLDivElement;
function Probe({ pending, scope }: { pending: boolean; scope: string }) {
  const stalled = useWorkflowWaitState(pending, scope);
  return <output data-pending={String(pending)}>{String(stalled)}</output>;
}
async function render(pending = true, scope = 'visit-1') {
  await act(async () => root.render(<Probe pending={pending} scope={scope} />));
}

describe('bounded workflow feedback without releasing the write', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
    host = document.createElement('div');
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    expect(appStateListeners.size).toBe(0);
    vi.useRealTimers();
  });

  it('stalls feedback after 20 seconds while the underlying request remains pending', async () => {
    await render();
    await act(async () => vi.advanceTimersByTimeAsync(19_999));
    expect(host.textContent).toBe('false');
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(host.textContent).toBe('true');
    expect(host.querySelector('output')?.dataset.pending).toBe('true');
  });

  it('clears stalled feedback when the original operation completes and gives the next action its own budget', async () => {
    await render();
    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    await render(false);
    expect(host.textContent).toBe('false');
    await render(true);
    expect(host.textContent).toBe('false');
  });

  it('never carries a previous visit deadline into the next visit', async () => {
    await render();
    await act(async () => vi.advanceTimersByTimeAsync(20_000));
    await render(true, 'visit-2');
    expect(host.textContent).toBe('false');
  });

  it.each(['app', 'browser'])('uses elapsed wall time when %s background timers were suspended', async (surface) => {
    await render();
    vi.setSystemTime(new Date('2026-10-07T12:10:00Z'));
    await act(async () => {
      if (surface === 'app') appStateListeners.forEach((listener) => listener('active'));
      else document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(host.textContent).toBe('true');
  });
});
