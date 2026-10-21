import { describe, expect, it } from 'vitest';
import type { AcademyCertificate, AcademyCourse, AcademyEnrollment, AcademyWorkspace } from '@/lib/akademie/workspaceModel';
import { academyAddDays, academyDateText, academyMonthDays, academyRenewalEligibility, academyShiftMonth, academyToday, buildAcademyPlanning, isAcademyDateOnly } from '@/lib/akademie/workspacePlanning';
import { createAcademyTemplate } from '@/lib/akademie/workspaceTemplates';

const content = { ...createAcademyTemplate('blank'), title: 'Sicher arbeiten', audiences: ['employee', 'client', 'family'] as const, mandatory: true };
function enrollment(overrides: Partial<AcademyEnrollment> = {}): AcademyEnrollment {
  return { id: 'enrollment-one', courseId: 'course-one', versionId: 'version-one', versionNumber: 1, revision: 1,
    participant: { id: 'person-one', kind: 'employee', name: 'Ada Beispiel', contextLabel: 'Team Nord', portalReady: true },
    dueDate: '2026-10-21', state: 'assigned', progress: 0, completedLessonIds: [], attempts: [],
    content: { ...content, audiences: [...content.audiences] }, assignedAt: '2026-10-01T08:00:00Z', startedAt: null,
    submittedAt: null, completedAt: null, reviewNote: null, certificateId: null, ...overrides };
}
function certificate(overrides: Partial<AcademyCertificate> = {}): AcademyCertificate {
  return { id: 'proof-one', enrollmentId: 'enrollment-one', number: 'AK-1', courseTitle: 'Sicher arbeiten',
    participantName: 'Ada Beispiel', audience: 'employee', issuedAt: '2026-10-01T10:00:00Z', validUntil: '2026-10-31',
    revokedAt: null, revokedReason: null, issuerName: 'Bea Beispiel', organizationName: 'Testorganisation',
    versionNumber: 1, estimatedMinutes: 20, ...overrides };
}
function workspace(enrollments: AcademyEnrollment[], certificates: AcademyCertificate[] = []): AcademyWorkspace {
  return { schemaVersion: 1, viewer: { mode: 'office', name: 'Verwaltung', audience: null },
    capabilities: { manageCourses: true, assign: true, review: true, learn: false },
    courses: [], participants: [], enrollments, certificates };
}

describe('Academy calendar and deadlines', () => {
  it('keeps German calendar dates stable through midnight, DST, leap day and year boundaries', () => {
    expect(academyToday(new Date('2026-10-20T22:30:00Z'))).toBe('2026-10-21');
    expect(academyToday(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
    expect(academyAddDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(academyShiftMonth('2026-12', 1)).toBe('2027-01');
    expect(academyShiftMonth('2027-01', -1)).toBe('2026-12');
    expect(academyMonthDays('2028-02').filter(Boolean)).toHaveLength(29);
    expect(academyMonthDays('2026-11').slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(academyMonthDays('2026-11').length % 7).toBe(0);
    expect(isAcademyDateOnly('2026-02-29')).toBe(false);
    expect(isAcademyDateOnly('2028-02-29')).toBe(true);
    expect(academyDateText('2026-10-21')).toBe('21.10.2026');
    expect(academyDateText('2026-02-30')).toBe('Datum nicht verfügbar');
  });

  it('applies person, audience and obligation filters without putting ended learning on the agenda', () => {
    const active = enrollment();
    const undated = enrollment({ id: 'undated', dueDate: null });
    const data = workspace([active, undated, enrollment({ id: 'submitted', state: 'submitted' }),
      enrollment({ id: 'completed', state: 'completed' }), enrollment({ id: 'cancelled', state: 'cancelled' }),
      enrollment({ id: 'optional', content: { ...active.content, mandatory: false } }),
      enrollment({ id: 'client', participant: { ...active.participant, kind: 'client' } })]);
    const result = buildAcademyPlanning(data, { month: '2026-10', today: '2026-10-21', audience: 'employee', mandatoryOnly: true, query: 'team nord' });
    expect(result.days).toHaveLength(31);
    expect(result.days.find(day => day.date === '2026-10-21')!.enrollments.map(entry => entry.id)).toEqual(['enrollment-one', 'submitted']);
    expect(result.undatedEnrollments.map(entry => entry.id)).toEqual(['undated']);
    expect(buildAcademyPlanning(data, { month: '2026-10', query: 'nicht vorhanden' }).days.flatMap(day => day.enrollments)).toEqual([]);
  });

  it('shows only the latest proof per course and person, inclusive of the 30-day boundary', () => {
    const old = enrollment({ state: 'completed' });
    const renewed = enrollment({ id: 'renewed', state: 'completed', previousEnrollmentId: old.id });
    const family = enrollment({ id: 'family', state: 'completed', participant: { ...old.participant, kind: 'family' } });
    const data = workspace([old, renewed, family], [certificate({ validUntil: '2025-10-31' }),
      certificate({ id: 'renewed-proof', enrollmentId: renewed.id, issuedAt: '2026-10-21T08:00:00Z', validUntil: '2027-10-31' }),
      certificate({ id: 'family-proof', enrollmentId: family.id, audience: 'family', validUntil: '2026-11-20' })]);
    const result = buildAcademyPlanning(data, { month: '2026-11', today: '2026-10-21' });
    expect(result.expiringCertificates.map(entry => entry.id)).toEqual(['family-proof']);
    expect(result.days.flatMap(day => day.certificates).map(entry => entry.id)).toEqual(['family-proof']);
    data.certificates[2].validUntil = '2026-11-21';
    expect(buildAcademyPlanning(data, { month: '2026-11', today: '2026-10-21' }).expiringCertificates).toEqual([]);
  });

  it('never resurrects an older proof after the newest proof is revoked and ignores unlinked proofs', () => {
    const old = enrollment({ state: 'completed' });
    const next = enrollment({ id: 'next', state: 'completed' });
    const data = workspace([old, next], [certificate(), certificate({ id: 'newest', enrollmentId: next.id,
      issuedAt: '2026-10-21T12:00:00Z', revokedAt: '2026-10-21T13:00:00Z' }), certificate({ id: 'orphan', enrollmentId: 'missing' })]);
    expect(buildAcademyPlanning(data, { month: '2026-10', today: '2026-10-21' }).expiringCertificates).toEqual([]);
  });
});

describe('Academy explicit follow-up eligibility', () => {
  const source = enrollment({ state: 'completed', progress: 100 });
  const course: AcademyCourse = { id: source.courseId, revision: 4, status: 'published', publishedVersionId: 'version-two', versionNumber: 2, content: source.content, updatedAt: '2026-10-21T12:00:00Z' };
  it('uses the current published version and permits a new link after an ended follow-up', () => {
    expect(academyRenewalEligibility(source, [course], [source])).toEqual({ course, reason: null });
    const ended = enrollment({ id: 'ended-follow-up', state: 'cancelled', previousEnrollmentId: source.id, assignedAt: '2026-10-20T12:00:00Z' });
    expect(academyRenewalEligibility(ended, [course], [source, ended]).reason).toBeNull();
    expect(academyRenewalEligibility(enrollment({ state: 'cancelled' }), [course], []).reason).toBeTruthy();
  });
  it('blocks duplicate and parallel cycles and stale prior completions without treating a historical snapshot as current access', () => {
    const next = enrollment({ id: 'next', previousEnrollmentId: source.id, assignedAt: '2026-10-20T12:00:00Z' });
    expect(academyRenewalEligibility(source, [course], [source, next]).reason).toMatch('bereits angelegt');
    expect(academyRenewalEligibility(source, [course], [source, { ...next, previousEnrollmentId: null }]).reason).toMatch('läuft bereits');
    expect(academyRenewalEligibility(source, [course], [source, { ...next, previousEnrollmentId: null, state: 'completed', completedAt: '2026-10-21T12:00:00Z' }]).reason).toMatch('jüngsten Abschluss');
    expect(academyRenewalEligibility({ ...source, participant: { ...source.participant, portalReady: false } }, [course], [source]).reason).toBeNull();
    expect(academyRenewalEligibility(source, [{ ...course, status: 'archived' }], [source]).course).toBeNull();
  });
});
