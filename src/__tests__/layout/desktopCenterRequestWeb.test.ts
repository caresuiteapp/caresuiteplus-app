import { beforeEach, describe, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => ({ ref: { current: false }, effects: [] as (() => void)[] }));
vi.mock('react', () => ({
  useRef: () => hooks.ref,
  useEffect: (effect: () => void) => { hooks.effects.push(effect); },
}));
import { useDesktopCenterRequest } from '@/hooks/useDesktopCenterRequest.web';

beforeEach(() => { hooks.ref.current = false; hooks.effects = []; });

function request(requestedTab: string | string[] | undefined, ready: boolean, onOpen: () => void, onConsumed: () => void) {
  useDesktopCenterRequest({ requestedTab, ready, onOpen, onConsumed });
  hooks.effects.splice(0).forEach(effect => effect());
}

describe('Apps & Widgets desktop link', () => {
  it('waits for the current authenticated desktop and its saved selection', () => {
    const open = vi.fn(); const consume = vi.fn();
    request('apps', false, open, consume);
    expect(open).not.toHaveBeenCalled(); expect(consume).not.toHaveBeenCalled();
    request('apps', true, open, consume);
    expect(open).toHaveBeenCalledTimes(1); expect(consume).toHaveBeenCalledTimes(1);
  });

  it('does not reopen the catalogue on rerender before the router clears the parameter', () => {
    const open = vi.fn(); const consume = vi.fn();
    request('apps', true, open, consume);
    request('apps', true, open, consume);
    request('apps', false, open, consume);
    request('apps', true, open, consume);
    expect(open).toHaveBeenCalledTimes(1); expect(consume).toHaveBeenCalledTimes(1);
  });

  it('accepts a later explicit request after the first one was cleared', () => {
    const open = vi.fn(); const consume = vi.fn();
    request('apps', true, open, consume);
    request(undefined, true, open, consume);
    request('apps', true, open, consume);
    expect(open).toHaveBeenCalledTimes(2); expect(consume).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, 'widgets', 'unknown', ['apps'], ['apps', 'workflows']].map(value => ({ value })))('ignores unsupported or repeated query values: %j', ({ value }) => {
    const open = vi.fn(); const consume = vi.fn();
    request(value, true, open, consume);
    expect(open).not.toHaveBeenCalled(); expect(consume).not.toHaveBeenCalled();
  });
});
