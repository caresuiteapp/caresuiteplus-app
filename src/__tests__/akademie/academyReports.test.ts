import { describe, expect, it } from 'vitest';
import { deriveAcademyReport } from '@/lib/akademie/academyReports';
import { createAcademyReportCsv } from '@/lib/akademie/academyReportsExport';
import type { AcademyCertificate, AcademyEnrollment } from '@/lib/akademie/workspaceModel';

function enrollment(id: string, state: AcademyEnrollment['state'], patch: Partial<AcademyEnrollment> = {}): AcademyEnrollment {
  return {
    id, state, courseId: 'course-a', versionId: 'version-a', versionNumber: 1, revision: 1,
    participant: { id, name: `Person ${id}`, kind: 'employee', contextLabel: '', portalReady: true },
    content: { title: 'Schulung', summary: '', category: '', audiences: ['employee'], estimatedMinutes: 20, mandatory: true, passPercent: 80, maxAttempts: 3, lessons: [] },
    dueDate: '2026-10-20', progress: 0, completedLessonIds: [], attempts: [], assignedAt: '2026-10-01T12:00:00Z',
    startedAt: null, submittedAt: null, completedAt: null, reviewNote: null, certificateId: null, ...patch,
  };
}
function certificate(id: string, enrollmentId: string, patch: Partial<AcademyCertificate> = {}): AcademyCertificate {
  return {
    id, enrollmentId, number: `AK-${id}`, courseTitle: 'Schulung', participantName: 'Person', audience: 'employee',
    issuedAt: '2026-10-01T12:00:00Z', validUntil: '2026-10-20', revokedAt: null, revokedReason: null,
    issuerName: 'Prüfperson', organizationName: 'Organisation', versionNumber: 1, estimatedMinutes: 20, ...patch,
  };
}

describe('academy reports from authorized workspace records', () => {
  it('separates cancelled and submitted records from open deadlines and states the completion denominator', () => {
    const rows = [enrollment('done', 'completed'), enrollment('cancelled', 'cancelled'), enrollment('pending', 'submitted'), enrollment('assigned', 'assigned'), enrollment('returned', 'returned')];
    const report = deriveAcademyReport(rows, [], [], '2026-10-21');
    expect(report).toMatchObject({ total: 5, completed: 1, cancelled: 1, submitted: 1, open: 2, completionBase: 4, completionRate: 25, overdue: 2, mandatoryOverdue: 2 });
    expect(deriveAcademyReport([enrollment('cancelled', 'cancelled')], [], [], '2026-10-21').completionRate).toBeNull();
    expect(deriveAcademyReport([], [], [], '2026-10-21').completionRate).toBeNull();
  });

  it('counts cycles individually but only the latest certificate per person and course for expiry', () => {
    const old = enrollment('old', 'completed');
    const renewed = enrollment('renewed', 'completed', { participant: old.participant, versionNumber: 2, previousEnrollmentId: old.id });
    const other = enrollment('other', 'completed');
    const revoked = enrollment('revoked', 'completed');
    const report = deriveAcademyReport([old, renewed, other, revoked], [
      certificate('old-proof', old.id), certificate('new-proof', renewed.id, { issuedAt: '2026-10-21T12:00:00Z', validUntil: '2027-10-21' }),
      certificate('other-proof', other.id, { validUntil: '2026-11-20' }),
      certificate('revoked-proof', revoked.id, { revokedAt: '2026-10-20T12:00:00Z' }),
    ], [], '2026-10-21');
    expect(report.completed).toBe(4);
    expect(report.certificates).toMatchObject({ historical: 4, current: 3, expiring: 1, expired: 0, revoked: 1 });
    expect(report.courses[0]?.versions).toEqual([1, 2]);
  });

  it('does not make an older certificate current when a title filter excludes the later cycle', () => {
    const old = enrollment('old', 'completed');
    const renewed = enrollment('renewed', 'completed', { participant: old.participant, previousEnrollmentId: old.id });
    const oldProof = certificate('old-proof', old.id);
    const newProof = certificate('new-proof', renewed.id, { issuedAt: '2026-10-21T12:00:00Z', validUntil: null });
    const report = deriveAcademyReport([old], [oldProof], [], '2026-10-21', { enrollments: [old, renewed], certificates: [oldProof, newProof] });
    expect(report.certificates).toMatchObject({ historical: 1, current: 0, expired: 0 });
  });

  it('keeps the inclusive 30-day boundary across a year change and excludes unrelated certificates', () => {
    const rows = ['today', 'end', 'later', 'expired', 'unlimited'].map(id => enrollment(id, 'completed'));
    const report = deriveAcademyReport(rows, [
      certificate('today', 'today', { validUntil: '2026-12-15' }),
      certificate('end', 'end', { validUntil: '2027-01-14' }),
      certificate('later', 'later', { validUntil: '2027-01-15' }),
      certificate('expired', 'expired', { validUntil: '2026-12-14' }),
      certificate('unlimited', 'unlimited', { validUntil: null }),
      certificate('unrelated', 'inaccessible', { validUntil: '2026-12-14' }),
    ], [], '2026-12-15');
    expect(report.expiringThrough).toBe('2027-01-14');
    expect(report.certificates).toMatchObject({ historical: 5, current: 5, expiring: 2, expired: 1, withoutExpiry: 1 });
  });

  it('exports only aggregate course rows and neutralizes formula prefixes hidden by control characters', () => {
    const dangerous = enrollment('secret-person', 'completed');
    dangerous.content.title = '\t\r =HYPERLINK("https://example.com"); Weitere Zeile';
    dangerous.participant.name = 'Nicht exportierte Person';
    const csv = createAcademyReportCsv(deriveAcademyReport([dangerous], [], [], '2026-10-21'));
    expect(csv.startsWith('\uFEFF"Stichtag"')).toBe(true);
    expect(csv).toContain('"\'\t\r =HYPERLINK(""https://example.com""); Weitere Zeile"');
    expect(csv).not.toContain('Nicht exportierte Person');
    expect(csv).not.toContain('secret-person');
    expect(csv).toContain('"2026-10-21"');
  });
});
