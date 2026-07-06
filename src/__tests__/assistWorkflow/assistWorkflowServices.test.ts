import { describe, expect, it } from 'vitest';
import { buildServiceRecordHtml } from '@/features/assistWorkflow/buildServiceRecordHtml';
import type { EmployeePortalAssignmentDetail } from '@/types/modules/employeePortalExecution';

const detail: EmployeePortalAssignmentDetail = {
  assignmentId: 'a1',
  tenantId: 't1',
  title: 'Hauswirtschaft',
  clientId: 'c1',
  clientName: 'Heinz-Peter Reinhardt',
  locationAddress: 'Musterstraße 1',
  plannedStartAt: '2026-06-29T09:00:00.000Z',
  plannedEndAt: '2026-06-29T10:00:00.000Z',
  actualStartAt: null,
  actualEndAt: null,
  status: 'beendet',
  canonicalStatus: 'completed',
  notesForEmployee: '',
  accessHints: null,
  emergencyContact: null,
  tasks: [{ id: 't1', title: 'Küche', description: '', required: true, status: 'done', completionNote: null, requiresNote: false }],
  statusHistory: [],
  pauseEvents: [],
  documentationStatus: 'draft',
  signatureStatus: 'none',
  requiresSignature: true,
  requiresDocumentation: true,
  requiresRoute: true,
  canStartExecution: false,
  canOpenRoute: true,
  canCaptureGps: true,
  allowedTransitions: [],
  isLocked: false,
  enabledModules: [],
};

describe('assistWorkflow services', () => {
  it('buildServiceRecordHtml includes client and tasks', () => {
    const html = buildServiceRecordHtml({
      detail,
      visitTimes: { driveSeconds: 600, serviceSeconds: 3600, pauseSeconds: null, totalSeconds: 4200, driveStartedAt: null, serviceStartedAt: null, pauseStartedAt: null, arrivedAt: null, serviceEndedAt: null, activeTimer: null },
      documentationText: 'Alles erledigt',
    });
    expect(html).toContain('Heinz-Peter Reinhardt');
    expect(html).toContain('Alle geplanten Aufgaben wurden vollständig erledigt.');
    expect(html).not.toContain('>Küche<');
    expect(html).toContain('Alles erledigt');
  });
});
