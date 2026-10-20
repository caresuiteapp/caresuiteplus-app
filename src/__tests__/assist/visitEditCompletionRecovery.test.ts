import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import { validateVisitEditCompletion } from '@/lib/assist/validateVisitEditCompletion';
import { mapVisitDetailToEditForm } from '@/lib/assist/visitEditMappers';

const repo = vi.hoisted(() => ({ getById: vi.fn(), resolveVisitId: vi.fn(), update: vi.fn(), updateAssignmentStatus: vi.fn(), listSeriesOccurrences: vi.fn() }));
vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({ visitSupabaseRepository: repo }));
vi.mock('@/lib/assist/overlayVisitDispositionFromAssignment', () => ({ overlayVisitDispositionDetailFromAssignment: async (_tenant: string, value: unknown) => value }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/permissions', () => ({ enforcePermission: () => null }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
import { updateVisitFromWizard } from '@/lib/assist/visitService';

const visit = {
  id: '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab', tenantId: 'tenant', clientId: 'client',
  title: 'Einsatz', serviceName: 'Betreuung', assignmentStatus: 'unterschrift_offen',
  scheduledStart: '2026-09-07T07:00:00Z', scheduledEnd: '2026-09-07T09:00:00Z',
  actualStartAt: '2026-09-07T07:00:00Z', actualEndAt: '2026-09-07T09:00:00Z',
  executionStatus: 'completed', documentationStatus: 'complete', proofStatus: 'pending',
  tasks: [], recurrenceJson: { pattern: 'none' },
} as unknown as VisitDispositionDetail;

beforeEach(() => vi.clearAllMocks());
describe('edit completion prevalidation', () => {
  it('rejects missing end time before writing any form field or status', async () => {
    const missingEnd = { ...visit, actualEndAt: null };
    repo.getById.mockResolvedValue({ ok: true, data: missingEnd });
    const form = { ...mapVisitDetailToEditForm(missingEnd), assignmentStatus: 'abgeschlossen' as const };
    const result = await updateVisitFromWizard('tenant', visit.id, form, 'business_admin');
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('Ist-Zeiten') });
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.updateAssignmentStatus).not.toHaveBeenCalled();
  });
  it('routes pending portal signatures to administrative follow-up without certifying them', () => {
    expect(validateVisitEditCompletion(visit, 'abgeschlossen')).toContain('Nachbearbeitung abschließen');
    expect(validateVisitEditCompletion({ ...visit, proofStatus: 'verified' }, 'abgeschlossen')).toBeNull();
  });
  it('preserves ordinary edits and checks actual completion requirements', () => {
    expect(validateVisitEditCompletion(visit, 'unterschrift_offen')).toBeNull();
    expect(validateVisitEditCompletion({ ...visit, documentationStatus: 'open' }, 'abgeschlossen')).toContain('Dokumentation');
    expect(validateVisitEditCompletion({ ...visit, tasks: [{ id: 'task', title: 'Aufgabe', status: 'open', isRequired: true, notDoneReason: null }] }, 'abgeschlossen')).toContain('Pflichtaufgaben');
  });
  it('validates every series target before changing the first occurrence', async () => {
    const selected = { ...visit, proofStatus: 'verified' as const, recurrenceJson: { pattern: 'weekly', weekdays: ['mo'] } };
    repo.getById.mockResolvedValue({ ok: true, data: selected });
    repo.resolveVisitId.mockResolvedValue(visit.id);
    repo.listSeriesOccurrences.mockResolvedValue({ ok: true, data: [selected, { ...selected, id: 'following', assignmentStatus: 'bestaetigt', executionStatus: 'pending', documentationStatus: 'none', proofStatus: 'none', actualStartAt: null, actualEndAt: null, scheduledStart: '2026-09-14T07:00:00Z' }] });
    const form = { ...mapVisitDetailToEditForm(selected), assignmentStatus: 'abgeschlossen' as const };
    const result = await updateVisitFromWizard('tenant', visit.id, form, 'business_admin', 'this_and_following');
    expect(result.ok).toBe(false);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
