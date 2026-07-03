import { describe, expect, it } from 'vitest';
import {
  mergeVisitDispositionWithExecution,
} from '@/lib/assist/visitDispositionExecutionEnrichment';
import { buildVisitProofPreview } from '@/lib/assist/visitProofPreviewService';
import type { VisitDispositionDetail } from '@/lib/assist/visitTypes';

function baseDetail(): VisitDispositionDetail {
  return {
    id: '70f800b8-a04f-44ae-846f-dcc7f6f6497a',
    tenantId: '56180c22-b894-4fab-b55e-a563c94dd6e7',
    clientId: 'client-1',
    employeeId: 'employee-1',
    title: 'Hauswirtschaftliche Unterstützung',
    serviceName: 'Entlastungsleistung §45b SGB XI',
    scheduledStart: '2026-07-01T14:00:00.000Z',
    scheduledEnd: '2026-07-01T17:00:00.000Z',
    durationMinutes: 180,
    status: 'aktiv',
    assignmentStatus: 'bestaetigt',
    planningStatus: 'confirmed',
    proofStatus: 'none',
    billingStatus: 'preview',
    location: 'Ringstraße 3, Herne',
    clientName: 'Heinz-Peter Reinhardt',
    employeeName: 'Mhi Aldeen Al Jlelati',
    isAtRisk: false,
    isIncomplete: true,
    updatedAt: '2026-07-01T18:32:39.416487Z',
    serviceKey: null,
    description: null,
    notes: null,
    employeeNotes: null,
    executionStatus: 'pending',
    documentationStatus: 'none',
    portalStatus: 'scheduled',
    allowedStatusTransitions: [],
    tasks: [
      { id: 't1', title: 'Küche reinigen', status: 'open', isRequired: true, notDoneReason: null },
      { id: 't2', title: 'Einsatz antreten', status: 'open', isRequired: true, notDoneReason: null },
      { id: 't3', title: 'Unterwegs markieren', status: 'open', isRequired: true, notDoneReason: null },
      { id: 't4', title: 'Angekommen markieren', status: 'open', isRequired: true, notDoneReason: null },
      { id: 't5', title: 'Einsatz starten', status: 'open', isRequired: true, notDoneReason: null },
    ],
    budget: null,
    portalReleaseEnabled: true,
    employeePortalVisible: true,
    errorCode: null,
    errorMessage: null,
    onTheWayAt: null,
    arrivedAt: null,
    finishedAt: null,
    actualStartAt: null,
    actualEndAt: null,
    createdAt: '2026-07-01T12:00:00.000Z',
  };
}

describe('visitDispositionExecutionEnrichment', () => {
  it('merges assignment execution state, tasks and timestamps into stale assist_visits detail', () => {
    const merged = mergeVisitDispositionWithExecution({
      detail: baseDetail(),
      assignmentStatus: 'beendet',
      assignmentTasks: [
        { id: 'a1', title: 'Küche reinigen', status: 'done', isRequired: true, notDoneReason: null },
        { id: 'a2', title: 'Einsatz antreten', status: 'open', isRequired: true, notDoneReason: null },
        { id: 'a3', title: 'Unterwegs markieren', status: 'open', isRequired: true, notDoneReason: null },
        { id: 'a4', title: 'Angekommen markieren', status: 'open', isRequired: true, notDoneReason: null },
        { id: 'a5', title: 'Einsatz starten', status: 'open', isRequired: true, notDoneReason: null },
      ],
      documentationText: 'Alles erledigt',
      visitTimes: {
        driveSeconds: 31,
        serviceSeconds: 10800,
        pauseSeconds: null,
        totalSeconds: 10831,
        driveStartedAt: '2026-07-01T15:28:25.701Z',
        serviceStartedAt: '2026-07-01T15:31:55.931Z',
        pauseStartedAt: null,
        arrivedAt: '2026-07-01T15:28:56.281Z',
        serviceEndedAt: '2026-07-01T18:32:36.617Z',
        activeTimer: null,
      },
      executionStateStatus: 'beendet',
      hasSignature: false,
      hasProof: false,
      persistedSignature: null,
      assignmentOnTheWayAt: null,
      assignmentArrivedAt: null,
      assignmentActualStartAt: '2026-07-01T15:30:50.188Z',
      assignmentActualEndAt: '2026-07-01T18:32:30.804Z',
      assignmentFinishedAt: null,
    });

    expect(merged.assignmentStatus).toBe('beendet');
    expect(merged.executionStatus).toBe('completed');
    expect(merged.actualStartAt).toBe('2026-07-01T15:31:55.931Z');
    expect(merged.actualEndAt).toBe('2026-07-01T18:32:36.617Z');
    expect(merged.tasks.find((task) => task.title === 'Küche reinigen')?.status).toBe('done');
    expect(merged.tasks.find((task) => task.title === 'Unterwegs markieren')?.status).toBe('done');
    expect(merged.tasks.find((task) => task.title === 'Einsatz starten')?.status).toBe('done');
    expect(merged.employeeNotes).toBe('Alles erledigt');
    expect(merged.documentationStatus).toBe('complete');
    expect(merged.isIncomplete).toBe(true);

    const preview = buildVisitProofPreview(merged, merged.employeeNotes);
    const docField = preview.fields.find((field) => field.label === 'Dokumentation');
    const signatureField = preview.fields.find((field) => field.label === 'Unterschrift');
    expect(docField?.missing).toBe(false);
    expect(docField?.value).toBe('Alles erledigt');
    expect(signatureField?.missing).toBe(true);
    expect(preview.readyForExport).toBe(false);
  });

  it('marks visit complete when documentation and signature exist', () => {
    const merged = mergeVisitDispositionWithExecution({
      detail: baseDetail(),
      assignmentStatus: 'unterschrift_offen',
      assignmentTasks: [],
      documentationText: 'Alles erledigt',
      visitTimes: null,
      executionStateStatus: 'unterschrift_offen',
      hasSignature: true,
      hasProof: false,
      persistedSignature: {
        visitId: '70f800b8-a04f-44ae-846f-dcc7f6f6497a',
        signerName: 'Heinz-Peter Reinhardt',
        signerRole: 'client',
        signedAt: '2026-07-01T18:40:00.000Z',
        dataUrl: '',
      },
      assignmentOnTheWayAt: null,
      assignmentArrivedAt: null,
      assignmentActualStartAt: null,
      assignmentActualEndAt: null,
      assignmentFinishedAt: null,
    });

    expect(merged.proofStatus).toBe('signed');
    expect(merged.isIncomplete).toBe(false);
    const preview = buildVisitProofPreview(merged, merged.employeeNotes);
    const signatureField = preview.fields.find((field) => field.label === 'Unterschrift');
    expect(signatureField?.missing).toBe(false);
    expect(signatureField?.value).toBe('Metadaten ohne Signaturbild');
    expect(preview.signatureImageUrl).toBeNull();
    expect(preview.readyForExport).toBe(true);
  });

  it('shows drawn signature in preview when persistedSignature includes image URL', () => {
    const merged = mergeVisitDispositionWithExecution({
      detail: baseDetail(),
      assignmentStatus: 'unterschrift_offen',
      assignmentTasks: [],
      documentationText: 'Alles erledigt',
      visitTimes: null,
      executionStateStatus: 'unterschrift_offen',
      hasSignature: true,
      hasProof: false,
      persistedSignature: {
        visitId: '70f800b8-a04f-44ae-846f-dcc7f6f6497a',
        signerName: 'Heinz-Peter Reinhardt',
        signerRole: 'client',
        signedAt: '2026-07-01T18:40:00.000Z',
        dataUrl: 'https://storage.example/signatures/sig.png',
      },
      assignmentOnTheWayAt: null,
      assignmentArrivedAt: null,
      assignmentActualStartAt: null,
      assignmentActualEndAt: null,
      assignmentFinishedAt: null,
    });

    const preview = buildVisitProofPreview(merged, merged.employeeNotes);
    expect(preview.signatureImageUrl).toBe('https://storage.example/signatures/sig.png');
    expect(preview.fields.find((field) => field.label === 'Unterschrift')?.value).toBe(
      'Gezeichnete Unterschrift vorhanden',
    );
  });
});
