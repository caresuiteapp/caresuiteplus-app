import { describe, expect, it } from 'vitest';
import { formatAddress, formatStreetLine } from '@/lib/formatAddress';
import { createLiveTrackingError } from '@/features/liveTracking/liveTrackingErrors';

describe('formatAddress', () => {
  it('combines street and house number', () => {
    expect(formatStreetLine('Ringstraße', '3')).toBe('Ringstraße 3');
    expect(formatAddress({ street: 'Torgauer Straße', houseNumber: '7', zip: '04315', city: 'Leipzig' })).toBe(
      'Torgauer Straße 7, 04315 Leipzig',
    );
  });

  it('avoids duplicate house number when street already contains it', () => {
    expect(formatStreetLine('Ringstraße 3', '3')).toBe('Ringstraße 3');
    expect(formatAddress({ street: 'Ringstraße 3', houseNumber: '3', zip: '44627', city: 'Herne' })).toBe(
      'Ringstraße 3, 44627 Herne',
    );
  });
});

describe('liveTrackingErrors', () => {
  it('maps error codes to German user messages', () => {
    const err = createLiveTrackingError('LIVE_SESSION_CREATE_FAILED', {
      tenantId: 't1',
      operation: 'test',
    });
    expect(err.userMessage).toContain('Tracking');
    expect(err.code).toBe('LIVE_SESSION_CREATE_FAILED');
  });
});

describe('resolveEmployeeLiveContext', () => {
  it('rejects missing tenant', async () => {
    const { resolveEmployeeLiveContext } = await import(
      '@/features/liveTracking/resolveEmployeeLiveContext'
    );
    const result = await resolveEmployeeLiveContext({
      tenantId: null,
      employeeId: 'e1',
      routeParamId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.ok).toBe(false);
  });
});

describe('startEmployeeLiveTracking', () => {
  it('exports start function', async () => {
    const mod = await import('@/features/liveTracking/startEmployeeLiveTracking');
    expect(typeof mod.startEmployeeLiveTracking).toBe('function');
  });
});
