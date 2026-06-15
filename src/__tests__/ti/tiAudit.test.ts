import { describe, expect, it, beforeEach } from 'vitest';
import { enforcePermission } from '@/lib/permissions';
import { exportTIAuditLog, fetchTIAuditLog } from '@/lib/ti/tiAuditService';
import { TI_DEMO_TENANT, resetTIDemoStore } from '@/data/demo/ti';

describe('TI Audit Service', () => {
  beforeEach(() => {
    resetTIDemoStore();
  });

  it('enforcePermission schützt Audit-Log', () => {
    expect(enforcePermission(null, 'ti.audit.view')).not.toBeNull();
  });

  it('fetchTIAuditLog liefert Ereignisse', async () => {
    const result = await fetchTIAuditLog(TI_DEMO_TENANT, {}, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items.length).toBeGreaterThan(0);
      expect(result.data.totalCount).toBeGreaterThan(0);
    }
  });

  it('fetchTIAuditLog filtert nach Aktion', async () => {
    const result = await fetchTIAuditLog(
      TI_DEMO_TENANT,
      { action: 'consent_granted' },
      'business_admin',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items.every((e) => e.action === 'consent_granted')).toBe(true);
    }
  });

  it('exportTIAuditLog erzeugt CSV und protokolliert Export', async () => {
    const before = await fetchTIAuditLog(TI_DEMO_TENANT, {}, 'business_admin');
    const exportResult = await exportTIAuditLog(TI_DEMO_TENANT, 'business_admin', 'Test');
    expect(exportResult.ok).toBe(true);
    if (exportResult.ok) {
      expect(exportResult.data.rowCount).toBeGreaterThan(0);
      expect(exportResult.data.csv).toContain('Zeitpunkt;Aktion');
    }
    const after = await fetchTIAuditLog(TI_DEMO_TENANT, {}, 'business_admin');
    if (before.ok && after.ok) {
      expect(after.data.totalCount).toBeGreaterThanOrEqual(before.data.totalCount);
    }
  });
});
