import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  practiceLocationToPhysicianDraft, saveManualPhysician, searchNationalPracticeLocations,
  searchNationalPracticeLocationsPage, searchPracticeLocationsPage,
} from '@/lib/pflege/medicationMasterData';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc }) }));

const tenant = '10000000-0000-4000-8000-000000000001';
const wellbrock = {
  id: '8ed2d099-239c-4d09-a9b4-5b9441fc1e04', displayName: 'Dr. med. Uwe Wellbrock', practiceName: null,
  specialty: 'Allgemeinmedizin; Innere Medizin', postalCode: null, city: 'Herne', street: null, phone: null,
  source: 'osm-de-praxis', sourceVersion: '2026-11-12', sourceUpdatedAt: '2026-09-13', stateCode: 'DE-NW', stateName: 'Nordrhein-Westfalen',
};

beforeEach(() => rpc.mockReset());

describe('Pflege practice contact transfer', () => {
  it('supplements the reported incomplete location and saves the full draft only after the person is identified', async () => {
    rpc.mockResolvedValueOnce({ data: [wellbrock], error: null });
    const result = await searchNationalPracticeLocations(tenant, 'Wellbrock', 'DE-NW');
    expect(rpc).toHaveBeenCalledWith('search_pflege_osm_practice_locations', { p_tenant: tenant, p_query: 'Wellbrock', p_state: 'DE-NW' });
    if (!result.ok) throw new Error(result.error);
    expect(result.data[0]).toMatchObject({
      source: 'osm-de-praxis', sourceUpdatedAt: '2026-09-13', contactSourceUrl: 'https://www.praxis-wellbrock.de/index.php/kontakt.html',
    });
    const draft = practiceLocationToPhysicianDraft(result.data[0]);
    expect(await saveManualPhysician(tenant, draft)).toMatchObject({ ok: false });
    expect(rpc).toHaveBeenCalledTimes(1);

    const input = { ...draft, displayName: 'Dr. med. Uwe Wellbrock' };
    const stored = { ...input, id: '10000000-0000-4000-8000-000000000002', source: 'manual', sourceVersion: 'local', lanr: null, bsnr: null };
    rpc.mockResolvedValueOnce({ data: stored, error: null });
    expect(await saveManualPhysician(tenant, input)).toEqual({ ok: true, data: stored });
    expect(rpc).toHaveBeenLastCalledWith('save_pflege_manual_physician', { p_tenant: tenant, p_row: {
      displayName: 'Dr. med. Uwe Wellbrock', practiceName: 'Dr. med. Uwe Wellbrock', specialty: 'Allgemeinmedizin; Innere Medizin',
      postalCode: '44623', city: 'Herne', street: 'Schaeferstraße 31', phone: '02323 51913', lanr: null, bsnr: null,
    } });
  });

  it('keeps authoritative values, a namesake, and a different snapshot separate', async () => {
    const namesake = { ...wellbrock, id: '10000000-0000-4000-8000-000000000003' };
    const differentSnapshot = { ...wellbrock, sourceVersion: '2026-11-15' };
    const existingPhone = { ...wellbrock, phone: '02323 0815' };
    rpc.mockResolvedValueOnce({ data: [namesake, differentSnapshot, existingPhone], error: null });
    const result = await searchNationalPracticeLocations(tenant, 'Wellbrock', null);
    if (!result.ok) throw new Error(result.error);
    expect(result.data.slice(0, 2)).toEqual([namesake, differentSnapshot]);
    expect(result.data[2]).toMatchObject({ phone: '02323 0815', street: 'Schaeferstraße 31' });
    expect(practiceLocationToPhysicianDraft(result.data[0])).toMatchObject({ displayName: '', postalCode: '', phone: '', street: '' });
  });

  it('retrieves subsequent results under the same state and offers a limited old-server fallback only for page one', async () => {
    rpc.mockResolvedValueOnce({ data: { rows: [wellbrock], nextCursor: null }, error: null });
    const page = await searchNationalPracticeLocationsPage(tenant, 'Wellbrock', 'DE-NW', '10000000-0000-4000-8000-000000000003');
    expect(page).toMatchObject({ ok: true, data: { rows: [{ postalCode: '44623' }], nextCursor: null } });
    expect(rpc).toHaveBeenCalledWith('search_pflege_osm_practice_locations_page', {
      p_tenant: tenant, p_query: 'Wellbrock', p_state: 'DE-NW', p_after: '10000000-0000-4000-8000-000000000003',
    });

    const ruhrRows = Array.from({ length: 30 }, (_, index) => ({ ...wellbrock, source: 'rvr-ruhr-praxis', id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}` }));
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } }).mockResolvedValueOnce({ data: ruhrRows, error: null });
    expect(await searchPracticeLocationsPage(tenant, 'Herne')).toEqual({ ok: true, data: { rows: ruhrRows, nextCursor: null, limited: true } });
    expect(rpc).toHaveBeenLastCalledWith('search_pflege_practice_locations', { p_tenant: tenant, p_query: 'Herne' });
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } });
    expect(await searchPracticeLocationsPage(tenant, 'Herne', ruhrRows[0].id)).toMatchObject({ ok: false });
    expect(rpc).toHaveBeenCalledTimes(4);
  });

  it('does not fall back after a permission failure or accept an inconsistent next cursor', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } }).mockResolvedValueOnce({ data: { rows: [wellbrock], nextCursor: wellbrock.id }, error: null });
    expect(await searchNationalPracticeLocationsPage(tenant, 'Wellbrock', null)).toMatchObject({ ok: false });
    expect(await searchNationalPracticeLocationsPage(tenant, 'Wellbrock', null)).toMatchObject({ ok: false });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
