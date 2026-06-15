import { describe, expect, it } from 'vitest';
import {
  mapTenantProductRow,
  mapTenantProductRows,
  type TenantProductLiveRow,
} from '@/lib/modules/moduleAccessRepository.supabase';

const sampleRow: TenantProductLiveRow = {
  id: 'tp-1',
  tenant_id: 'tenant-1',
  product_id: 'prod-assist',
  is_active: true,
  activated_at: '2026-06-15T10:00:00.000Z',
  access_source: 'free_active',
  included_by_module_key: null,
  is_base_included: false,
  billing_status: 'free_active',
  access_type: 'free',
  price_cents: 0,
  premium_ready: false,
  products: { key: 'assist' },
};

describe('moduleAccessRepository.supabase', () => {
  it('mapTenantProductRow nutzt products.key statt product_key', () => {
    const mapped = mapTenantProductRow(sampleRow);
    expect(mapped?.productKey).toBe('assist');
    expect(mapped?.isActive).toBe(true);
    expect(mapped?.accessSource).toBe('free_active');
  });

  it('mapTenantProductRows ergänzt fehlende Module als inaktiv', () => {
    const modules = mapTenantProductRows('tenant-1', [sampleRow]);
    expect(modules).toHaveLength(6);
    expect(modules.find((entry) => entry.productKey === 'assist')?.isActive).toBe(true);
    expect(modules.find((entry) => entry.productKey === 'pflege')?.isActive).toBe(false);
  });
});
