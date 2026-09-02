import { describe, expect, it } from 'vitest';
import { selectPortalEmployeeId } from '@/hooks/usePortalActor';

describe('employee portal actor link R20.2', () => {
  it('uses the AuthProvider employee link before starting another account lookup', () => {
    expect(selectPortalEmployeeId(null, 'employee-from-profile', null)).toBe(
      'employee-from-profile',
    );
  });

  it('keeps the explicit portal-session link authoritative', () => {
    expect(
      selectPortalEmployeeId(
        'employee-from-session',
        'employee-from-profile',
        'employee-from-query',
      ),
    ).toBe('employee-from-session');
  });
});
