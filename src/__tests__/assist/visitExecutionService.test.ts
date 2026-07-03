import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';
import {
  saveVisitSignature,
  clearVisitSignature,
  hasVisitSignature,
} from '@/lib/assist/visitSignatureSessionStore';

const visitSupabaseRepository = vi.hoisted(() => ({
  resolveVisitId: vi.fn(),
  updateTask: vi.fn(),
}));

const assignmentSupabaseRepository = vi.hoisted(() => ({
  updateTask: vi.fn(),
}));

const fetchVisitDispositionDetail = vi.hoisted(() => vi.fn());

vi.mock('@/lib/assist/repositories/visitRepository.supabase', () => ({
  visitSupabaseRepository,
}));

vi.mock('@/lib/assist/repositories/assignmentRepository.supabase', () => ({
  assignmentSupabaseRepository,
}));

vi.mock('@/lib/assist/visitService', () => ({
  fetchVisitDispositionDetail,
}));

vi.mock('@/lib/services/mode', () => ({
  getServiceMode: vi.fn(() => 'supabase'),
}));

vi.mock('@/lib/permissions', () => ({
  enforcePermission: vi.fn(() => null),
}));

vi.mock('@/lib/services/liveServiceGuard', () => ({
  guardServiceTenant: vi.fn(() => null),
}));

import {
  updateVisitTaskStatus,
  validateVisitCloseReadiness,
} from '@/lib/assist/visitExecutionService';

const TENANT = DEMO_TENANT_ID;
const VISIT_ID = '70f800b8-a04f-44ae-846f-dcc7f6f6497a';
const TASK_ID = 'task-legacy-1';
const ADMIN = 'business_admin' as const;

function baseDetail(overrides: Partial<VisitDispositionDetail> = {}): VisitDispositionDetail {
  return {
    id: VISIT_ID,
    tenantId: TENANT,
    clientId: 'client-1',
    employeeId: 'employee-1',
    title: 'Hauswirtschaft',
    serviceName: 'Entlastung',
    scheduledStart: '2026-07-01T14:00:00.000Z',
    scheduledEnd: '2026-07-01T17:00:00.000Z',
    durationMinutes: 180,
    status: 'aktiv',
    assignmentStatus: 'gestartet',
    planningStatus: 'confirmed',
    proofStatus: 'none',
    billingStatus: 'preview',
    location: 'Ringstraße 3',
    clientName: 'Heinz-Peter Reinhardt',
    employeeName: 'Test MA',
    isAtRisk: false,
    isIncomplete: true,
    updatedAt: '2026-07-01T18:00:00.000Z',
    serviceKey: null,
    description: null,
    notes: null,
    employeeNotes: null,
    executionStatus: 'in_progress',
    documentationStatus: 'none',
    portalStatus: 'scheduled',
    allowedStatusTransitions: [],
    tasks: [
      { id: TASK_ID, title: 'Küche reinigen', status: 'open', isRequired: true, notDoneReason: null },
    ],
    budget: null,
    portalReleaseEnabled: true,
    employeePortalVisible: true,
    errorCode: null,
    errorMessage: null,
    onTheWayAt: null,
    arrivedAt: null,
    finishedAt: null,
    actualStartAt: '2026-07-01T14:05:00.000Z',
    actualEndAt: null,
    createdAt: '2026-07-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('visitExecutionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearVisitSignature(VISIT_ID);
    visitSupabaseRepository.resolveVisitId.mockResolvedValue(null);
    fetchVisitDispositionDetail.mockResolvedValue({ ok: true, data: baseDetail() });
  });

  afterEach(() => {
    clearVisitSignature(VISIT_ID);
  });

  describe('updateVisitTaskStatus — assist_visit_tasks fallback', () => {
    it('falls back to legacy assignment_tasks when visit task row is missing', async () => {
      visitSupabaseRepository.resolveVisitId.mockResolvedValue('visit-uuid-1');
      visitSupabaseRepository.updateTask.mockResolvedValue({
        ok: false,
        error: 'Aufgabe nicht gefunden.',
      });
      assignmentSupabaseRepository.updateTask.mockResolvedValue({ ok: true, data: undefined });
      fetchVisitDispositionDetail.mockResolvedValue({
        ok: true,
        data: baseDetail({
          tasks: [{ id: TASK_ID, title: 'Küche', status: 'done', isRequired: true, notDoneReason: null }],
        }),
      });

      const result = await updateVisitTaskStatus(
        VISIT_ID,
        TASK_ID,
        TENANT,
        'done',
        ADMIN,
      );

      expect(result.ok).toBe(true);
      expect(assignmentSupabaseRepository.updateTask).toHaveBeenCalledWith(
        TENANT,
        VISIT_ID,
        TASK_ID,
        'done',
        undefined,
      );
      expect(fetchVisitDispositionDetail).toHaveBeenCalled();
    });

    it('does not treat 0-row visit update as success when error is not task-not-found', async () => {
      visitSupabaseRepository.resolveVisitId.mockResolvedValue('visit-uuid-1');
      visitSupabaseRepository.updateTask.mockResolvedValue({
        ok: false,
        error: 'Datenbankfehler beim Speichern.',
      });

      const result = await updateVisitTaskStatus(
        VISIT_ID,
        TASK_ID,
        TENANT,
        'done',
        ADMIN,
      );

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Datenbankfehler beim Speichern.');
      expect(assignmentSupabaseRepository.updateTask).not.toHaveBeenCalled();
    });

    it('maps partial/not_possible visit status to assignment not_done with reason', async () => {
      visitSupabaseRepository.resolveVisitId.mockResolvedValue(null);
      assignmentSupabaseRepository.updateTask.mockResolvedValue({ ok: true, data: undefined });

      await updateVisitTaskStatus(
        VISIT_ID,
        TASK_ID,
        TENANT,
        'not_possible',
        ADMIN,
        'Klient:in abwesend',
      );

      expect(assignmentSupabaseRepository.updateTask).toHaveBeenCalledWith(
        TENANT,
        VISIT_ID,
        TASK_ID,
        'not_done',
        'Klient:in abwesend',
      );
    });

    it('returns legacy repository error instead of silent success', async () => {
      visitSupabaseRepository.resolveVisitId.mockResolvedValue(null);
      assignmentSupabaseRepository.updateTask.mockResolvedValue({
        ok: false,
        error: 'Aufgabe nicht gefunden.',
      });

      const result = await updateVisitTaskStatus(
        VISIT_ID,
        TASK_ID,
        TENANT,
        'done',
        ADMIN,
      );

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Aufgabe nicht gefunden.');
    });
  });

  describe('validateVisitCloseReadiness', () => {
    it('requires reason-backed statuses to be resolved (no open required tasks)', () => {
      const result = validateVisitCloseReadiness({
        tasks: [
          { id: '1', title: 'Pflicht', status: 'open', isRequired: true, notDoneReason: null },
        ],
        documentationNote: 'Alles dokumentiert',
        hasSignature: true,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('Pflichtaufgabe');
      }
    });

    it('accepts persistedSignature path via hasSignature flag', () => {
      const result = validateVisitCloseReadiness({
        tasks: [
          { id: '1', title: 'Pflicht', status: 'done', isRequired: true, notDoneReason: null },
        ],
        documentationNote: 'Doku ok',
        hasSignature: true,
      });
      expect(result).toEqual({ valid: true });
    });

    it('accepts session signature when hasSignature reflects session store', () => {
      saveVisitSignature({
        visitId: VISIT_ID,
        dataUrl: 'data:image/png;base64,abc',
        signerName: 'Heinz-Peter Reinhardt',
        signerRole: 'Klient:in',
        signedAt: new Date().toISOString(),
      });
      expect(hasVisitSignature(VISIT_ID)).toBe(true);

      const result = validateVisitCloseReadiness({
        tasks: [
          { id: '1', title: 'Pflicht', status: 'done', isRequired: true, notDoneReason: null },
        ],
        documentationNote: 'Doku ok',
        hasSignature: hasVisitSignature(VISIT_ID),
      });
      expect(result).toEqual({ valid: true });
    });

    it('blocks close when documentation missing even with signature', () => {
      const result = validateVisitCloseReadiness({
        tasks: [
          { id: '1', title: 'Pflicht', status: 'done', isRequired: true, notDoneReason: null },
        ],
        documentationNote: '  ',
        hasSignature: true,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('Dokumentation');
      }
    });

    it('blocks close when signature missing', () => {
      const result = validateVisitCloseReadiness({
        tasks: [
          { id: '1', title: 'Pflicht', status: 'done', isRequired: true, notDoneReason: null },
        ],
        documentationNote: 'Doku ok',
        hasSignature: false,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('Unterschrift');
      }
    });
  });
});
