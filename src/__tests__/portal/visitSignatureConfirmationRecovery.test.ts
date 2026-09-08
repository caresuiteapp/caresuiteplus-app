import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSingleFlight } from '@/lib/services/singleFlight';
import { readVisitSignatureConfirmation } from '@/lib/portal/readVisitSignatureConfirmation';
import { fetchValidVisitSignature } from '@/lib/assist/assistExecutionPersistenceService';

vi.mock('@/lib/assist/assistExecutionPersistenceService', () => ({ fetchValidVisitSignature: vi.fn() }));
const read = vi.mocked(fetchValidVisitSignature);
const scope = { tenantId: 'tenant-a', visitId: 'visit-a', isWritePending: () => false };
const signature = {
  tenantId: 'tenant-a', visitId: 'visit-a', isValid: true,
  storagePath: 'tenant/tenant-a/assist/visits/visit-a/signatures/example.png', signatureHash: 'hash',
} as NonNullable<Extract<Awaited<ReturnType<typeof fetchValidVisitSignature>>, { ok: true }>['data']>;

beforeEach(() => { vi.useFakeTimers(); read.mockReset(); });
afterEach(() => vi.useRealTimers());

describe('signature confirmation after interrupted submission', () => {
  it('releases an orphaned pending flag after a successful scoped read proves absence', async () => {
    read.mockResolvedValue({ ok: true, data: null });
    expect(await readVisitSignatureConfirmation(scope)).toMatchObject({ state: 'missing' });
    expect(read).toHaveBeenCalledWith('tenant-a', 'visit-a');
  });

  it('confirms a valid server row without waiting for unrelated visit requests', async () => {
    read.mockResolvedValue({ ok: true, data: signature });
    expect(await readVisitSignatureConfirmation(scope)).toEqual({ state: 'confirmed' });
  });

  it.each([
    { ok: false as const, error: 'read forbidden' },
    { ok: true as const, data: null, tableMissing: true },
  ])('never treats a failed or unavailable table read as absence: %j', async (response) => {
    read.mockResolvedValue(response);
    expect(await readVisitSignatureConfirmation(scope)).toMatchObject({ state: 'unavailable' });
  });

  it('bounds a stalled read and preserves the unknown state', async () => {
    read.mockImplementation(() => new Promise(() => {}));
    const result = readVisitSignatureConfirmation(scope);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(await result).toMatchObject({ state: 'unavailable' });
  });

  it('does not interpret a rejected read as missing', async () => {
    read.mockRejectedValue(new Error('offline'));
    expect(await readVisitSignatureConfirmation(scope)).toMatchObject({ state: 'unavailable' });
  });

  it.each([
    { tenantId: 'tenant-b' }, { visitId: 'visit-b' }, { isValid: false },
    { storagePath: '' }, { signatureHash: '' },
  ])('rejects a mismatched or incomplete confirmation: %j', async (change) => {
    read.mockResolvedValue({ ok: true, data: { ...signature, ...change } });
    expect(await readVisitSignatureConfirmation(scope)).toMatchObject({ state: 'unavailable' });
  });

  it('protects a write even after its caller has stopped waiting, and releases only on settlement', async () => {
    const write = createSingleFlight();
    const key = 'tenant-a:employee-a:visit-a:save_signature';
    let finish!: () => void;
    const operation = write(key, () => new Promise<void>((resolve) => { finish = resolve; }));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(60_000);
    const input = { ...scope, isWritePending: () => write.isPending(key) };
    expect(await readVisitSignatureConfirmation(input)).toEqual({ state: 'writing' });
    expect(read).not.toHaveBeenCalled();
    expect(write.isPending('tenant-b:employee-b:visit-b:save_signature')).toBe(false);
    expect(write(key, vi.fn())).toBe(operation);
    finish(); await operation;
    read.mockResolvedValue({ ok: true, data: null });
    expect(await readVisitSignatureConfirmation(input)).toMatchObject({ state: 'missing' });
  });

  it('protects a new write that starts while the confirmation read is in flight', async () => {
    let pending = false;
    let finish!: (value: Awaited<ReturnType<typeof fetchValidVisitSignature>>) => void;
    read.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const result = readVisitSignatureConfirmation({ ...scope, isWritePending: () => pending });
    pending = true; finish({ ok: true, data: signature });
    expect(await result).toEqual({ state: 'writing' });
  });

  it('cleans up rejected writes so a confirmed absence can enable a retry', async () => {
    const write = createSingleFlight();
    await expect(write('scope', () => Promise.reject(new Error('upload rejected')))).rejects.toThrow();
    expect(write.isPending('scope')).toBe(false);
  });
});
