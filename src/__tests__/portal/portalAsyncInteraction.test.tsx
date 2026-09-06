// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useMutation } from '@/hooks/core/useMutation';
import {
  PortalMessengerFocusProvider,
  usePortalMessengerFocus,
} from '@/lib/portal/portalMessengerFocusContext';
import { sharedPortalRead } from '@/lib/portal/sharedPortalRead';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
}));
vi.mock('@/hooks/core/useLiveRefresh', () => ({
  DEFAULT_LIVE_POLL_MS: 30_000,
  useLiveRefresh: () => ({ isLiveConnected: false }),
}));
vi.mock('@/lib/services/queryTimeout', () => ({
  NATIVE_SERVICE_QUERY_TIMEOUT_MS: 10000,
  withServiceQueryTimeout: (promise: Promise<unknown>) => promise,
}));
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const ok = (data: string) => ({ ok: true as const, data });
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const render = async (element: React.ReactNode) => {
  await act(async () => root.render(element));
};

describe('Portal data lifecycle on a mounted React tree', () => {
  it('shows cached data during a slow load and updates cache metadata only for the accepted result', async () => {
    const flight = deferred<ReturnType<typeof ok>>();
    let state!: ReturnType<typeof useAsyncQuery<string>>;
    function Probe() {
      state = useAsyncQuery(() => flight.promise, [], {
        initialCache: async () => ({
          ...ok('saved'),
          fromCache: true,
          cachedAt: '2026-09-06T10:00:00Z',
        }),
      });
      return (
        <div>
          {state.data}:{String(state.cacheMeta.fromCache)}
        </div>
      );
    }
    await render(<Probe />);
    expect(host.textContent).toBe('saved:true');
    expect(state.loading).toBe(false);
    await act(async () => flight.resolve(ok('live')));
    expect(host.textContent).toBe('live:false');
  });
  it('keeps unsaved text when the server read refreshes', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok('before')).mockResolvedValueOnce(ok('after'));
    let state!: ReturnType<typeof useAsyncQuery<string>>;
    function Probe() {
      state = useAsyncQuery(fetcher, []);
      const [draft, setDraft] = React.useState('');
      return (
        <>
          <button onClick={() => setDraft('Noch nicht gespeichert')}>Edit</button>
          <div>
            {state.data}:{draft}
          </div>
        </>
      );
    }
    await render(<Probe />);
    await act(async () => host.querySelector('button')!.click());
    await act(async () => {
      await state.refresh();
    });
    expect(host.textContent).toContain('after:Noch nicht gespeichert');
  });
  it('rejects late results and immediately removes data when the account changes', async () => {
    const first = deferred<ReturnType<typeof ok>>();
    const second = deferred<ReturnType<typeof ok>>();
    let state!: ReturnType<typeof useAsyncQuery<string>>;
    function Probe({
      account,
      fetcher,
    }: {
      account: string;
      fetcher: () => Promise<ReturnType<typeof ok>>;
    }) {
      state = useAsyncQuery(fetcher, [account], { queryKey: account });
      return <div>{state.data ?? 'loading'}</div>;
    }
    await render(<Probe account="one" fetcher={() => first.promise} />);
    await render(<Probe account="two" fetcher={() => second.promise} />);
    await act(async () => second.resolve(ok('second-account')));
    expect(host.textContent).toBe('second-account');
    await act(async () => first.resolve(ok('wrong-account')));
    expect(state.data).toBe('second-account');
    await render(<Probe account="three" fetcher={() => new Promise(() => {})} />);
    expect(host.textContent).toBe('loading');
  });
  it('renders the live result even if the cache read has not completed', async () => {
    const cache = deferred<ReturnType<typeof ok>>();
    function Probe() {
      const q = useAsyncQuery(async () => ok('live'), [], { initialCache: () => cache.promise });
      return <div>{q.data}</div>;
    }
    await render(<Probe />);
    expect(host.textContent).toBe('live');
    await act(async () => cache.resolve(ok('old-cache')));
    expect(host.textContent).toBe('live');
  });
  it('retains visible content during refresh and performs one trailing read after a burst', async () => {
    const flight = deferred<ReturnType<typeof ok>>();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(ok('visible'))
      .mockImplementationOnce(() => flight.promise)
      .mockResolvedValue(ok('latest'));
    let q!: ReturnType<typeof useAsyncQuery<string>>;
    function Probe() {
      q = useAsyncQuery(fetcher, []);
      return (
        <div>
          {q.data}:{String(q.loading)}
        </div>
      );
    }
    await render(<Probe />);
    await act(async () => {
      void q.refresh();
      void q.refresh();
      void q.refresh();
    });
    expect(host.textContent).toBe('visible:false');
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => flight.resolve(ok('intermediate')));
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(q.data).toBe('latest');
  });
  it('does not fetch a disabled query', async () => {
    const fetcher = vi.fn(async () => ok('unexpected'));
    function Probe() {
      const q = useAsyncQuery(fetcher, [], { enabled: false });
      return <div>{String(q.loading)}</div>;
    }
    await render(<Probe />);
    expect(fetcher).not.toHaveBeenCalled();
    expect(host.textContent).toBe('false');
  });
  it('releases the save lock after a thrown network error so a user can retry', async () => {
    const mutate = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(ok('saved'));
    let mutation!: ReturnType<typeof useMutation<void, string>>;
    function Probe() {
      mutation = useMutation(mutate);
      return <div>{mutation.error}</div>;
    }
    await render(<Probe />);
    await act(async () => {
      await mutation.mutate();
    });
    expect(mutation.loading).toBe(false);
    expect(mutation.error).toBe('offline');
    await act(async () => {
      expect(await mutation.mutate()).toBe('saved');
    });
    expect(mutate).toHaveBeenCalledTimes(2);
  });
});

describe('Portal chat selection', () => {
  function Inbox() {
    const chat = usePortalMessengerFocus();
    return (
      <>
        <button onClick={() => chat.openThread('thread-a', 'Team')}>Open</button>
        <button onClick={() => chat.openThread('thread-b')}>Another</button>
        <button onClick={chat.closeThread}>Back</button>
        <div>
          {chat.selectedThreadId ? `${chat.threadTitle}:${chat.selectedThreadId}` : 'Inbox'}
        </div>
      </>
    );
  }
  const press = async (text: string) => {
    await act(async () => {
      [...host.querySelectorAll('button')].find((button) => button.textContent === text)!.click();
    });
  };
  it('opens, switches and closes actual chat state without retaining another title', async () => {
    await render(
      <PortalMessengerFocusProvider>
        <Inbox />
      </PortalMessengerFocusProvider>,
    );
    await press('Open');
    expect(host.textContent).toContain('Team:thread-a');
    await press('Another');
    expect(host.textContent).toContain('Chat:thread-b');
    await press('Back');
    expect(host.textContent).toContain('Inbox');
  });
  it('clears selected chat when the portal account key changes', async () => {
    await render(
      <PortalMessengerFocusProvider key="one">
        <Inbox />
      </PortalMessengerFocusProvider>,
    );
    await press('Open');
    await render(
      <PortalMessengerFocusProvider key="two">
        <Inbox />
      </PortalMessengerFocusProvider>,
    );
    expect(host.textContent).toContain('Inbox');
  });
});

it('coalesces only simultaneous reads with the same account scope, including rejection recovery', async () => {
  const flight = deferred<string>();
  const read = vi.fn(() => flight.promise);
  const a = sharedPortalRead('account-a', read);
  const b = sharedPortalRead('account-a', read);
  const c = sharedPortalRead('account-b', async () => 'B');
  await Promise.resolve();
  expect(read).toHaveBeenCalledTimes(1);
  flight.resolve('A');
  expect(await Promise.all([a, b, c])).toEqual(['A', 'A', 'B']);
  await expect(
    sharedPortalRead('account-a', async () => {
      throw new Error('offline');
    }),
  ).rejects.toThrow('offline');
  expect(await sharedPortalRead('account-a', async () => 'retry')).toBe('retry');
});
