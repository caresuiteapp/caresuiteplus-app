import { describe, expect, it } from 'vitest';
import {
  fileNameFromStoragePath,
  inferMimeTypeFromFileName,
  normalizePhotoReferenceList,
  parseVisitInternalAttachments,
  visitInternalAttachmentPreviewMode,
} from '@/lib/assist/visitInternalAttachmentService';
import { mergeVisitDispositionWithExecution } from '@/lib/assist/visitDispositionExecutionEnrichment';

describe('visitInternalAttachmentService', () => {
  it('parses storage paths into attachment metadata', () => {
    const attachments = parseVisitInternalAttachments([
      'tenant/t1/assist/visits/v1/attachments/att-1.jpg',
      'tenant/t1/assist/visits/v1/attachments/att-2.pdf',
    ]);

    expect(attachments).toHaveLength(2);
    expect(attachments[0]?.fileName).toBe('att-1.jpg');
    expect(attachments[0]?.mimeType).toBe('image/jpeg');
    expect(attachments[1]?.mimeType).toBe('application/pdf');
    expect(visitInternalAttachmentPreviewMode(attachments[1]!.mimeType)).toBe('pdf');
  });

  it('normalizes photo reference arrays and ignores invalid entries', () => {
    expect(
      normalizePhotoReferenceList([
        ' tenant/t1/assist/visits/v1/attachments/a.jpg ',
        '',
        42,
        null,
      ]),
    ).toEqual(['tenant/t1/assist/visits/v1/attachments/a.jpg']);
  });

  it('infers mime types from file extensions', () => {
    expect(inferMimeTypeFromFileName('scan.PDF')).toBe('application/pdf');
    expect(inferMimeTypeFromFileName('foto.webp')).toBe('image/webp');
    expect(fileNameFromStoragePath('tenant/x/assist/visits/y/attachments/z.png')).toBe('z.png');
  });
});

describe('visitDispositionExecutionEnrichment photo references', () => {
  it('mergeVisitDispositionWithExecution carries internalPhotoReferences', () => {
    const merged = mergeVisitDispositionWithExecution({
      detail: {
        id: 'visit-1',
        tenantId: 'tenant-1',
        clientId: 'client-1',
        employeeId: 'employee-1',
        title: 'Test',
        serviceName: 'Test',
        scheduledStart: '2026-07-01T14:00:00.000Z',
        scheduledEnd: '2026-07-01T17:00:00.000Z',
        durationMinutes: 180,
        status: 'aktiv',
        assignmentStatus: 'beendet',
        planningStatus: 'confirmed',
        proofStatus: 'pending',
        billingStatus: 'preview',
        location: 'Berlin',
        clientName: 'Klient',
        employeeName: 'Mitarbeiter',
        isAtRisk: false,
        isIncomplete: false,
        updatedAt: '2026-07-01T18:00:00.000Z',
        serviceKey: null,
        description: null,
        notes: null,
        employeeNotes: null,
        executionStatus: 'completed',
        documentationStatus: 'complete',
        portalStatus: 'scheduled',
        allowedStatusTransitions: [],
        tasks: [],
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
      },
      assignmentStatus: 'beendet',
      assignmentTasks: [],
      documentationText: 'Dokumentation',
      visitTimes: null,
      executionStateStatus: 'beendet',
      hasSignature: false,
      hasProof: false,
      persistedSignature: null,
      assignmentOnTheWayAt: null,
      assignmentArrivedAt: null,
      assignmentActualStartAt: null,
      assignmentActualEndAt: null,
      assignmentFinishedAt: null,
      photoReferences: ['tenant/t1/assist/visits/v1/attachments/foto.jpg'],
    });

    expect(merged.internalPhotoReferences).toEqual([
      'tenant/t1/assist/visits/v1/attachments/foto.jpg',
    ]);
  });
});
