import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pollSignatureConfirmation } from '@/lib/portal/pollSignatureConfirmation';

describe('bounded signature confirmation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows an actionable unconfirmed state when a read never returns', async () => {
    const refresh = vi.fn(() => new Promise(() => {}));
    const onUnconfirmed = vi.fn();
    const stop = pollSignatureConfirmation({ refresh, onUnconfirmed });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnconfirmed).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnconfirmed).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not overlap slow reads or restart after a deadline', async () => {
    let finish!: () => void;
    const refresh = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const onUnconfirmed = vi.fn();
    pollSignatureConfirmation({ refresh, onUnconfirmed });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    finish();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnconfirmed).toHaveBeenCalledTimes(1);
  });

  it('stops polling when confirmation arrives and the owner disposes the poller', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onUnconfirmed = vi.fn();
    const stop = pollSignatureConfirmation({ refresh, onUnconfirmed });
    await vi.advanceTimersByTimeAsync(800);
    expect(refresh).toHaveBeenCalledTimes(1);
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnconfirmed).not.toHaveBeenCalled();
  });

  it('handles a rejected read without an unhandled rejection or an endless retry loop', async () => {
    const refresh = vi.fn().mockRejectedValue(new Error('offline'));
    const onUnconfirmed = vi.fn();
    pollSignatureConfirmation({ refresh, onUnconfirmed });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnconfirmed).toHaveBeenCalledTimes(1);
  });
});
