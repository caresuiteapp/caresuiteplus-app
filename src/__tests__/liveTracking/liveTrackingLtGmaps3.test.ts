import { describe, expect, it } from 'vitest';
import {
  classifyLiveTrackingError,
  liveTrackingSupportDetail,
  logLiveTrackingRuntimeError,
  normalizeSupabaseError,
} from '@/features/liveTracking/liveTrackingDiagnostics';

describe('liveTrackingDiagnostics', () => {
  it('normalizes PostgREST schema errors', () => {
    const normalized = normalizeSupabaseError({
      code: 'PGRST204',
      message: "Could not find the 'is_emergency' column of 'client_contacts' in the schema cache",
    });
    expect(classifyLiveTrackingError(normalized)).toBe('schema');
  });

  it('classifies RLS errors', () => {
    const normalized = normalizeSupabaseError({
      code: '42501',
      message: 'new row violates row-level security policy',
    });
    expect(classifyLiveTrackingError(normalized)).toBe('rls');
  });

  it('logs runtime errors with support detail', () => {
    const err = logLiveTrackingRuntimeError(
      'test.query',
      normalizeSupabaseError({ code: 'PGRST204', message: 'column missing' }),
      { tenantId: 't1', tableOrRpc: 'client_contacts' },
      'admin',
    );
    expect(err.code).toBe('LIVE_SCHEMA_MISMATCH');
    expect(liveTrackingSupportDetail(err)).toContain('PGRST204');
  });
});
