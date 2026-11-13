import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchAuthorizedMedicinesPage, searchMedicationPackagesPage } from '@/lib/pflege/medicationMasterData';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc }) }));

const tenant = '10000000-0000-4000-8000-000000000001';
const pack = { pzn: '00000017', source: 'catalog-test', sourceVersion: 'test-revision', name: 'Katalogpackung',
  ingredient: 'Prüfwirkstoff', strength: '5 mg', dosageForm: 'Tablette', brand: null, manufacturer: 'Prüfhersteller', packageSize: '30 Stück' };
const authorization = { id: '10000000-0000-4000-8000-000000000002', source: 'ema-article57', sourceVersion: 'test-revision',
  name: 'Zulassungseintrag', activeSubstance: 'Prüfwirkstoff', authorizationHolder: 'Test Inhaber', authorizationScope: 'DE' };

beforeEach(() => rpc.mockReset());

describe('Paginated medication catalog API', () => {
  it('keeps the package identity as the complete source and leading-zero PZN', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ ...pack, source: `catalog-${String(i).padStart(2, '0')}` }));
    const nextCursor = 'catalog-29:00000017';
    const next = { ...pack, source: 'catalog-30' };
    rpc.mockResolvedValueOnce({ data: { rows, nextCursor }, error: null })
      .mockResolvedValueOnce({ data: { rows: [next], nextCursor: null }, error: null });
    expect(await searchMedicationPackagesPage(tenant, 'PZN-00000017')).toEqual({ ok: true, data: { rows, nextCursor } });
    expect(await searchMedicationPackagesPage(tenant, 'PZN-00000017', nextCursor)).toEqual({ ok: true, data: { rows: [next], nextCursor: null } });
    expect(rpc.mock.calls).toEqual([
      ['search_pflege_medication_packages_page', { p_tenant: tenant, p_query: 'PZN-00000017', p_after: null }],
      ['search_pflege_medication_packages_page', { p_tenant: tenant, p_query: 'PZN-00000017', p_after: nextCursor }],
    ]);
    expect(await searchMedicationPackagesPage(tenant, 'Prüfwirkstoff', 'catalog-29:00000018')).toMatchObject({ ok: false });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('only falls back on a missing first-page endpoint and reports the former cap', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ ...authorization, id: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}` }));
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } })
      .mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } });
    expect(await searchAuthorizedMedicinesPage(tenant, 'Zulassungseintrag')).toEqual({ ok: true, data: { rows, nextCursor: null, limited: true } });
    expect(rpc).toHaveBeenNthCalledWith(2, 'search_pflege_authorized_medicines', { p_tenant: tenant, p_query: 'Zulassungseintrag' });
    expect(await searchAuthorizedMedicinesPage(tenant, 'Zulassungseintrag', authorization.id)).toMatchObject({ ok: false });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it('rejects cursor mismatch, replayed rows, and any package returned as an EMA authorization', async () => {
    rpc.mockResolvedValueOnce({ data: { rows: [pack], nextCursor: 'foreign:00000017' }, error: null })
      .mockResolvedValueOnce({ data: { rows: [pack], nextCursor: null }, error: null })
      .mockResolvedValueOnce({ data: { rows: [pack], nextCursor: null }, error: null });
    expect(await searchMedicationPackagesPage(tenant, 'Prüfwirkstoff')).toMatchObject({ ok: false });
    expect(await searchMedicationPackagesPage(tenant, 'Prüfwirkstoff', 'catalog-test:00000017')).toMatchObject({ ok: false });
    expect(await searchAuthorizedMedicinesPage(tenant, 'Prüfwirkstoff')).toMatchObject({ ok: false });
    expect(rpc).toHaveBeenCalledTimes(3);
  });
});
