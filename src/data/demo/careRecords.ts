import type { CareRecord, CareRecordDetail, CareRecordListItem, Signature } from '@/types/modules/assist';
import type { WorkflowStatus } from '@/types';
import { getDemoAssignmentSeedById } from './assistAssignments';
import { CARE_REPORT_TEMPLATES } from './generators/pflegeDemoGenerators';
import { demoClients } from './clients';
import { demoEmployees } from './employees';
import { DEMO_TENANT_ID } from './tenant';

type CareRecordSeed = CareRecord & {
  durationMinutes: number | null;
  location: string | null;
  pdfExportPath: string | null;
  signature: Signature | null;
};

function clientName(clientId: string): string {
  const c = demoClients.find((x) => x.id === clientId);
  return c ? `${c.firstName} ${c.lastName}` : 'Unbekannt';
}

function employeeName(employeeId: string): string {
  const e = demoEmployees.find((x) => x.id === employeeId);
  return e ? `${e.firstName} ${e.lastName}` : 'Unbekannt';
}

function enrich(seed: CareRecordSeed): CareRecordDetail {
  const assignment = getDemoAssignmentSeedById(seed.assignmentId);
  return {
    ...seed,
    assignmentTitle: assignment?.title ?? 'Einsatz',
    clientName: assignment ? clientName(assignment.clientId) : '—',
    employeeName: assignment ? employeeName(assignment.employeeId) : '—',
    hasSignature: seed.signature !== null,
    pdfReady: seed.status === 'abgeschlossen' && seed.signature !== null,
    signature: seed.signature ?? null,
  };
}

const INITIAL: CareRecordSeed[] = [
  {
    id: 'record-001',
    tenantId: DEMO_TENANT_ID,
    assignmentId: 'assign-003',
    content: 'Haushaltsführung abgeschlossen. Einkauf erledigt, Wäsche gewechselt.',
    recordedAt: '2026-06-01T11:30:00.000Z',
    status: 'abgeschlossen',
    createdAt: '2026-06-01T11:30:00.000Z',
    updatedAt: '2026-06-01T11:35:00.000Z',
    visibility: 'team',
    sensitivity: 'care',
    durationMinutes: 95,
    location: 'Prenzlauer Berg, Berlin',
    pdfExportPath: 'demo://nachweise/record-001.pdf',
    signature: {
      id: 'sig-001',
      tenantId: DEMO_TENANT_ID,
      careRecordId: 'record-001',
      signedByProfileId: 'profile-caregiver-001',
      signedByName: 'Thomas Keller',
      signedAt: '2026-06-01T11:35:00.000Z',
      signatureDataUrl: null,
      status: 'abgeschlossen',
      createdAt: '2026-06-01T11:35:00.000Z',
      updatedAt: '2026-06-01T11:35:00.000Z',
    },
  },
  {
    id: 'record-002',
    tenantId: DEMO_TENANT_ID,
    assignmentId: 'assign-001',
    content: 'Begleitung zum Termin — wartet auf Unterschrift.',
    recordedAt: '2026-06-01T09:00:00.000Z',
    status: 'in_bearbeitung',
    createdAt: '2026-06-01T09:00:00.000Z',
    updatedAt: '2026-06-01T09:00:00.000Z',
    visibility: 'team',
    sensitivity: 'care',
    durationMinutes: 120,
    location: 'Musterstraße 12, Berlin',
    pdfExportPath: null,
    signature: null,
  },
  ...buildExtraCareRecords(),
];

function buildExtraCareRecords(): CareRecordSeed[] {
  const assignmentIds = ['assign-001', 'assign-002', 'assign-003', 'assign-004', 'assign-005', 'assign-006'];
  const statuses: WorkflowStatus[] = ['abgeschlossen', 'in_bearbeitung', 'entwurf', 'aktiv'];
  const records: CareRecordSeed[] = [];

  for (let i = 0; i < 23; i++) {
    const daysBack = i % 14;
    const recordedAt = new Date(Date.now() - daysBack * 86_400_000 - (i % 8) * 3_600_000).toISOString();
    const status = statuses[i % statuses.length]!;
    const signed = status === 'abgeschlossen' && i % 2 === 0;

    records.push({
      id: `record-${String(i + 3).padStart(3, '0')}`,
      tenantId: DEMO_TENANT_ID,
      assignmentId: assignmentIds[i % assignmentIds.length]!,
      content: CARE_REPORT_TEMPLATES[i % CARE_REPORT_TEMPLATES.length]!,
      recordedAt,
      status,
      createdAt: recordedAt,
      updatedAt: recordedAt,
      visibility: 'team',
      sensitivity: i % 3 === 0 ? 'health' : 'care',
      durationMinutes: 30 + (i % 6) * 15,
      location: 'Berlin',
      pdfExportPath: signed ? `demo://nachweise/record-${String(i + 3).padStart(3, '0')}.pdf` : null,
      signature: signed
        ? {
            id: `sig-${String(i + 3).padStart(3, '0')}`,
            tenantId: DEMO_TENANT_ID,
            careRecordId: `record-${String(i + 3).padStart(3, '0')}`,
            signedByProfileId: 'profile-caregiver-001',
            signedByName: 'Thomas Keller',
            signedAt: recordedAt,
            signatureDataUrl: null,
            status: 'abgeschlossen',
            createdAt: recordedAt,
            updatedAt: recordedAt,
          }
        : null,
    });
  }

  return records;
}

let recordStore: CareRecordSeed[] = INITIAL.map((r) => ({ ...r }));

export function getDemoCareRecordListItems(): CareRecordListItem[] {
  return recordStore.map((r) => {
    const detail = enrich(r);
    return {
      id: detail.id,
      tenantId: detail.tenantId,
      assignmentId: detail.assignmentId,
      content: detail.content,
      recordedAt: detail.recordedAt,
      status: detail.status,
      updatedAt: detail.updatedAt,
      assignmentTitle: detail.assignmentTitle,
      clientName: detail.clientName,
      employeeName: detail.employeeName,
      hasSignature: detail.hasSignature,
      pdfReady: detail.pdfReady,
    };
  });
}

export function getDemoCareRecordById(id: string): CareRecordDetail | null {
  const seed = recordStore.find((r) => r.id === id);
  return seed ? enrich({ ...seed }) : null;
}

export function createDemoCareRecordFromAssignment(
  assignmentId: string,
  content: string,
  durationMinutes: number | null,
  location: string | null,
): CareRecordDetail | null {
  const assignment = getDemoAssignmentSeedById(assignmentId);
  if (!assignment) return null;

  const id = `record-${Date.now()}`;
  const now = new Date().toISOString();
  const seed: CareRecordSeed = {
    id,
    tenantId: DEMO_TENANT_ID,
    assignmentId,
    content,
    recordedAt: now,
    status: 'entwurf',
    createdAt: now,
    updatedAt: now,
    visibility: 'team',
    sensitivity: 'care',
    durationMinutes,
    location,
    pdfExportPath: null,
    signature: null,
  };
  recordStore = [seed, ...recordStore];
  return enrich(seed);
}

export function signDemoCareRecord(
  recordId: string,
  signedByProfileId: string,
  signedByName: string,
): CareRecordDetail | null {
  const index = recordStore.findIndex((r) => r.id === recordId);
  if (index < 0) return null;

  const now = new Date().toISOString();
  recordStore[index] = {
    ...recordStore[index],
    status: 'abgeschlossen',
    updatedAt: now,
    signature: {
      id: `sig-${Date.now()}`,
      tenantId: DEMO_TENANT_ID,
      careRecordId: recordId,
      signedByProfileId,
      signedByName,
      signedAt: now,
      signatureDataUrl: null,
      status: 'abgeschlossen',
      createdAt: now,
      updatedAt: now,
    },
  };
  return enrich(recordStore[index]);
}

export function exportDemoCareRecordPdf(recordId: string): string | null {
  const record = getDemoCareRecordById(recordId);
  if (!record || !record.hasSignature) return null;

  const path = `demo://nachweise/${recordId}.pdf`;
  const index = recordStore.findIndex((r) => r.id === recordId);
  if (index >= 0) {
    recordStore[index] = { ...recordStore[index], pdfExportPath: path, updatedAt: new Date().toISOString() };
  }
  return path;
}

export function buildCareRecordPdfText(record: CareRecordDetail): string {
  return [
    'CareSuite+ Leistungsnachweis',
    '────────────────────────────',
    `Einsatz: ${record.assignmentTitle}`,
    `Klient:in: ${record.clientName}`,
    `Mitarbeitende:r: ${record.employeeName}`,
    `Datum: ${new Date(record.recordedAt).toLocaleString('de-DE')}`,
    `Dauer: ${record.durationMinutes ?? '—'} Min.`,
    `Ort: ${record.location ?? '—'}`,
    '',
    'Dokumentation:',
    record.content,
    '',
    record.signature
      ? `Unterschrift: ${record.signature.signedByName} am ${new Date(record.signature.signedAt).toLocaleString('de-DE')}`
      : 'Noch nicht unterschrieben',
  ].join('\n');
}
