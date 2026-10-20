import { describe, expect, it } from 'vitest';
import {
  ACTIVE_CLIENT_LIFECYCLE_STATUSES,
  isDraftStatusFilter,
  resolveClientListQueryOptions,
} from '@/lib/services/clients/clientListQueryOptions';

describe('clientListQueryOptions', () => {
  it('setzt Lebenszyklus auf Alle bei Status Entwurf', () => {
    const resolved = resolveClientListQueryOptions({
      lifecycleFilter: 'active',
      statusFilter: 'entwurf',
    });

    expect(resolved?.lifecycleFilter).toBe('all');
    expect(resolved?.statusFilter).toBe('entwurf');
  });

  it('lässt andere Filter unverändert', () => {
    const resolved = resolveClientListQueryOptions({
      lifecycleFilter: 'active',
      statusFilter: 'aktiv',
      search: 'Muster',
    });

    expect(resolved?.lifecycleFilter).toBe('active');
    expect(resolved?.statusFilter).toBe('aktiv');
    expect(resolved?.search).toBe('Muster');
  });

  it('erkennt Entwurfs-Statusfilter', () => {
    expect(isDraftStatusFilter('entwurf')).toBe(true);
    expect(isDraftStatusFilter('aktiv')).toBe(false);
    expect(isDraftStatusFilter('all')).toBe(false);
  });

  it('schließt lead aus dem aktiven Lebenszyklus aus', () => {
    expect(ACTIVE_CLIENT_LIFECYCLE_STATUSES).not.toContain('lead');
    expect(ACTIVE_CLIENT_LIFECYCLE_STATUSES).toContain('active');
  });
});
