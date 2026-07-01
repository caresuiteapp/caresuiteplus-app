import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildVisitUpdateInputFromEditForm,
  mapVisitDetailToEditForm,
} from '@/lib/assist/visitEditMappers';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const SAMPLE_VISIT: VisitDispositionDetail = {
  id: '27be8d4e-e6e1-4b2a-bccb-918ade0ad1ab',
  tenantId: 'tenant-001',
  title: 'Alltagsbegleitung §45a SGB XI',
  serviceName: 'Alltagsbegleitung §45a SGB XI',
  scheduledStart: '2026-07-01T08:00:00.000Z',
  scheduledEnd: '2026-07-01T09:00:00.000Z',
  durationMinutes: 60,
  status: 'aktiv',
  assignmentStatus: 'bestaetigt',
  planningStatus: 'confirmed',
  proofStatus: 'none',
  billingStatus: 'none',
  location: 'Musterstraße 12, Herne',
  clientName: 'Heinz-Peter Reinhardt',
  employeeId: 'employee-001',
  employeeName: 'Kevin Reinhardt',
  isAtRisk: false,
  isIncomplete: false,
  updatedAt: '2026-07-01T07:00:00.000Z',
  clientId: 'client-001',
  serviceKey: 'alltagsbegleitung_45a',
  assignmentDate: '2026-07-01',
  description: 'Hausbesuch',
  notes: 'Bitte Klingel prüfen',
  employeeNotes: null,
  clientVisibleNotes: null,
  addressSnapshot: 'Musterstraße 12, Herne',
  locationNotes: 'Hintereingang',
  subjectKey: 'alltagsbegleitung',
  assignmentTypeKey: 'hausbesuch',
  serviceCategoryKey: 'sgb_xi_45a',
  taskPackageId: 'pkg-basic',
  billingBudgetSourceKey: 'pflegegeld',
  proofTemplateKey: 'einzel',
  riskFlagKeys: ['mobilitaet'],
  catalogSnapshotJson: { subjectKey: 'alltagsbegleitung' },
  recurrenceJson: { pattern: 'none' },
  executionStatus: 'pending',
  documentationStatus: 'none',
  portalStatus: 'hidden',
  allowedStatusTransitions: ['storniert'],
  tasks: [
    {
      id: 'task-1',
      title: 'Spaziergang',
      status: 'open',
      isRequired: true,
      notDoneReason: null,
    },
  ],
  budget: null,
  portalReleaseEnabled: false,
  employeePortalVisible: true,
  errorCode: null,
  errorMessage: null,
  onTheWayAt: null,
  arrivedAt: null,
  finishedAt: null,
  actualStartAt: null,
  actualEndAt: null,
  createdAt: '2026-06-28T10:00:00.000Z',
};

describe('visitEditMappers', () => {
  it('maps visit detail into edit form with date, people and catalog fields', () => {
    const form = mapVisitDetailToEditForm(SAMPLE_VISIT);

    expect(form.title).toBe('Alltagsbegleitung §45a SGB XI');
    expect(form.clientId).toBe('client-001');
    expect(form.employeeId).toBe('employee-001');
    expect(form.assignmentDate).toBe('2026-07-01');
    expect(form.addressSnapshot).toBe('Musterstraße 12, Herne');
    expect(form.internalNotes).toBe('Bitte Klingel prüfen');
    expect(form.subjectKey).toBe('alltagsbegleitung');
    expect(form.assignmentStatus).toBe('bestaetigt');
    expect(form.taskDrafts).toHaveLength(1);
  });

  it('buildVisitUpdateInputFromEditForm produces save payload', () => {
    const form = mapVisitDetailToEditForm(SAMPLE_VISIT);
    form.title = 'Aktualisierter Einsatz';

    const payload = buildVisitUpdateInputFromEditForm(form);
    expect(payload.title).toBe('Aktualisierter Einsatz');
    expect(payload.clientId).toBe('client-001');
    expect(payload.assignmentStatus).toBe('bestaetigt');
    expect(payload.tasks).toEqual(['Spaziergang']);
  });
});

describe('AssignmentEditForm UI contract', () => {
  it('renders visible form inputs with visit data and form viewContext', () => {
    const form = readSrc('src/components/assist/AssignmentEditForm.tsx');
    expect(form).toContain('PremiumInput');
    expect(form).toContain("viewContext: 'form'");
    expect(form).toContain('CareDateInput');
    expect(form).toContain('CareTimeInput');
    expect(form).toContain('mapVisitDetailToEditForm');
    expect(form).toContain('updateVisitFromWizard');
    expect(form).toContain('label="Bezeichnung *"');
    expect(form).toContain('label="Ort"');
    expect(form).toContain('label="Notizen"');
  });

  it('AssignmentEditScreen loads live visit detail instead of demo seed', () => {
    const screen = readSrc('src/screens/assist/AssignmentEditScreen.tsx');
    expect(screen).toContain('fetchVisitDispositionDetail');
    expect(screen).toContain('AssignmentEditForm');
    expect(screen).not.toContain('getDemoAssignmentSeedById');
    expect(screen).not.toContain('updateDemoAssignmentFields');
  });
});
