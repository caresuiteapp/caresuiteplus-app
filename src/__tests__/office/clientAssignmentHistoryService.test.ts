import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchClientAssignments } from '@/lib/assist/assignmentListService';
import { visitSupabaseRepository } from '@/lib/assist/repositories/visitRepository.supabase';

vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({ visitSupabaseRepository: { list: vi.fn() } }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/supabase/config', () => ({ isSupabaseConfigured: () => true }));

describe('Datenquelle des Monatsarchivs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fragt nur die gewählte Klientenakte ab und übernimmt echte Ausführungszeiten', async () => {
    const row = {
      id: 'visit-1', tenantId: 'tenant-1', clientId: 'client-1', employeeId: 'employee-1', title: 'Begleitung', serviceName: 'Begleitung',
      scheduledStart: '2026-09-11T07:00:00Z', scheduledEnd: '2026-09-11T09:00:00Z',
      status: 'in_bearbeitung', assignmentStatus: 'unterschrift_offen', planningStatus: 'confirmed',
      executionStatus: 'completed', documentationStatus: 'complete', proofStatus: 'pending', billingStatus: 'none',
      onTheWayAt: '2026-09-11T06:45:00Z', arrivedAt: '2026-09-11T07:00:00Z',
      actualStartAt: '2026-09-11T07:05:00Z', actualEndAt: '2026-09-11T08:50:00Z',
      location: '', clientName: 'Testperson', employeeName: 'Begleitung', updatedAt: '2026-09-11T09:00:00Z',
      durationMinutes: 120, isIncomplete: true, isAtRisk: false,
    } as const;
    vi.mocked(visitSupabaseRepository.list).mockResolvedValue({ ok: true, data: [row] });
    const result = await fetchClientAssignments('tenant-1', 'client-1', 'business_admin');
    expect(visitSupabaseRepository.list).toHaveBeenCalledWith('tenant-1', { clientId: 'client-1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data[0]).toMatchObject({
      id: row.id, assignmentStatus: 'unterschrift_offen', proofStatus: 'pending',
      onTheWayAt: row.onTheWayAt, arrivedAt: row.arrivedAt,
      actualStartAt: row.actualStartAt, actualEndAt: row.actualEndAt,
    });
  });

  it('liest ohne Aktenberechtigung keine Einsätze', async () => {
    expect((await fetchClientAssignments('tenant-1', 'client-1', null)).ok).toBe(false);
    expect(visitSupabaseRepository.list).not.toHaveBeenCalled();
  });

  it('meldet einen Datenfehler und gibt kein vermeintlich vollständiges Archiv aus', async () => {
    vi.mocked(visitSupabaseRepository.list).mockResolvedValue({ ok: false, error: 'Einsätze konnten nicht geladen werden.' });
    expect(await fetchClientAssignments('tenant-1', 'client-1', 'business_admin')).toEqual({ ok: false, error: 'Einsätze konnten nicht geladen werden.' });
  });
});
