import { describe, expect, it } from 'vitest';
import {
  normalizePlatformTenantListItem,
  resolvePlatformTenantDetailId,
} from '@/lib/platformConsole';

describe('Platform tenant list routing', () => {
  it('resolvePlatformTenantDetailId bevorzugt tenant_id gegenüber platform_tenants.id', () => {
    const detailId = resolvePlatformTenantDetailId({
      id: '15f57ce7-63e5-4ec8-803a-a510fca1a2fd',
      tenantId: '15f57ce7-63e5-4ec8-803a-a510fca1a2fd',
      tenant_id: 'b2222222-2222-4222-8222-222222222201',
    });
    expect(detailId).toBe('b2222222-2222-4222-8222-222222222201');
  });

  it('normalizePlatformTenantListItem mappt snake_case tenant_id auf tenantId', () => {
    const item = normalizePlatformTenantListItem({
      id: '15f57ce7-63e5-4ec8-803a-a510fca1a2fd',
      tenant_id: 'b2222222-2222-4222-8222-222222222201',
      tenant_name: 'Staging Test Tenant',
      status: 'active',
      lifecycle_status: 'live',
      billing_status: 'trial',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      active_module_count: 2,
    } as never);
    expect(item.tenantId).toBe('b2222222-2222-4222-8222-222222222201');
    expect(item.tenantId).not.toBe(item.id);
    expect(item.tenantName).toBe('Staging Test Tenant');
  });

  it('resolvePlatformTenantDetailId liefert null wenn keine Mandanten-ID vorhanden', () => {
    expect(resolvePlatformTenantDetailId({ id: 'row-only', tenantId: '' })).toBeNull();
  });

  it('übernimmt die verbindliche Echt-/Test-Klassifizierung aus dem Readmodel', () => {
    const item = normalizePlatformTenantListItem({
      id: 'row-id',
      tenant_id: '11111111-1111-1111-1111-111111111101',
      tenant_name: 'SonnenPflege Ambulant Köln',
      status: 'active',
      lifecycle_status: 'live',
      billing_status: 'trial',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      active_module_count: 3,
      environment_mode: 'pilot',
      is_pilot_tenant: true,
      is_synthetic: true,
      environment_notes: 'Fiktiver Pilotmandant',
    } as never);

    expect(item.environmentMode).toBe('pilot');
    expect(item.isPilotTenant).toBe(true);
    expect(item.isSynthetic).toBe(true);
  });

  it('behandelt nicht klassifizierte Mandanten niemals automatisch als Produktion', () => {
    const item = normalizePlatformTenantListItem({
      id: 'row-id', tenant_id: 'b2222222-2222-4222-8222-222222222201', tenant_name: 'Ungeprüft',
      status: 'active', lifecycle_status: 'live', billing_status: 'trial',
      created_at: '', updated_at: '', active_module_count: 0,
    } as never);
    expect(item.environmentMode).toBe('unclassified');
  });
});
