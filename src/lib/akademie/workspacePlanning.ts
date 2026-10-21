import type {
  AcademyAudience, AcademyCertificate, AcademyCourse, AcademyEnrollment, AcademyWorkspace,
} from './workspaceModel';

/** Calendar dates are kept as YYYY-MM-DD; no browser timezone conversion of deadlines. */
export function academyToday(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function isAcademyDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validMonth(month: string): boolean { return /^\d{4}-\d{2}$/.test(month) && isAcademyDateOnly(`${month}-01`); }
function monthOrToday(month: string): string { return validMonth(month) ? month : academyToday().slice(0, 7); }

export function academyAddDays(date: string, offset: number): string {
  if (!isAcademyDateOnly(date) || !Number.isSafeInteger(offset)) throw new Error('Ungültiges Kalenderdatum.');
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + offset);
  return next.toISOString().slice(0, 10);
}

export function academyShiftMonth(month: string, offset: number): string {
  const current = monthOrToday(month);
  if (!Number.isSafeInteger(offset)) return current;
  const next = new Date(`${current}-01T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + offset);
  return next.toISOString().slice(0, 7);
}

export function academyDateText(value: string | null): string {
  if (!value) return 'Ohne Frist';
  const date = value.slice(0, 10);
  if (!isAcademyDateOnly(date)) return 'Datum nicht verfügbar';
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', dateStyle: 'medium' }).format(new Date(`${date}T12:00:00Z`));
}

export function academyMonthText(month: string): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', month: 'long', year: 'numeric' })
    .format(new Date(`${monthOrToday(month)}-01T12:00:00Z`));
}

/** Monday-first complete calendar rows; null cells are outside the selected month. */
export function academyMonthDays(month: string): Array<string | null> {
  const selected = monthOrToday(month);
  const first = `${selected}-01`;
  const weekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const days: Array<string | null> = Array.from({ length: weekday }, () => null);
  for (let date = first; date.slice(0, 7) === selected; date = academyAddDays(date, 1)) days.push(date);
  while (days.length % 7) days.push(null);
  return days;
}

type PlanningOptions = {
  month: string;
  today?: string;
  audience?: 'all' | AcademyAudience;
  query?: string;
  mandatoryOnly?: boolean;
};
export type AcademyPlanningDay = { date: string; enrollments: AcademyEnrollment[]; certificates: AcademyCertificate[] };
export type AcademyPlanningData = {
  month: string;
  days: AcademyPlanningDay[];
  undatedEnrollments: AcademyEnrollment[];
  expiringCertificates: AcademyCertificate[];
};

const normalize = (value: string) => value.toLocaleLowerCase('de-DE').trim();
const coursePersonKey = (entry: AcademyEnrollment) => `${entry.courseId}:${entry.participant.kind}:${entry.participant.id}`;

export function academyLatestCertificates(workspace: Pick<AcademyWorkspace, 'enrollments' | 'certificates'>): AcademyCertificate[] {
  const enrollments = new Map(workspace.enrollments.map(entry => [entry.id, entry]));
  const latest = new Map<string, AcademyCertificate>();
  for (const certificate of workspace.certificates) {
    const enrollment = enrollments.get(certificate.enrollmentId);
    if (!enrollment) continue;
    const key = coursePersonKey(enrollment);
    const previous = latest.get(key);
    const time = Date.parse(certificate.issuedAt);
    const previousTime = previous ? Date.parse(previous.issuedAt) : -Infinity;
    if (!previous || time > previousTime || (time === previousTime && certificate.id > previous.id)) latest.set(key, certificate);
  }
  return [...latest.values()];
}

export function buildAcademyPlanning(workspace: AcademyWorkspace, options: PlanningOptions): AcademyPlanningData {
  const month = monthOrToday(options.month);
  const today = options.today && isAcademyDateOnly(options.today) ? options.today : academyToday();
  const query = normalize(options.query ?? '');
  const allEnrollments = new Map(workspace.enrollments.map(entry => [entry.id, entry]));
  const matches = (entry: AcademyEnrollment) => (!options.audience || options.audience === 'all' || entry.participant.kind === options.audience)
    && (!options.mandatoryOnly || entry.content.mandatory)
    && normalize(`${entry.content.title} ${entry.content.category} ${entry.participant.name} ${entry.participant.contextLabel}`).includes(query);
  const active = workspace.enrollments.filter(entry => !['completed', 'cancelled'].includes(entry.state) && matches(entry));

  // A renewed certificate replaces the old expiry warning; it does not erase its history.
  // Select the latest proof before filters/revocation so an older proof cannot reappear as current.
  const certificates = academyLatestCertificates(workspace).filter(certificate => {
    const enrollment = allEnrollments.get(certificate.enrollmentId)!;
    return !certificate.revokedAt && certificate.validUntil && isAcademyDateOnly(certificate.validUntil.slice(0, 10)) && matches(enrollment);
  });
  const days = academyMonthDays(month).filter((date): date is string => date !== null)
    .map(date => ({ date, enrollments: [] as AcademyEnrollment[], certificates: [] as AcademyCertificate[] }));
  const byDay = new Map(days.map(day => [day.date, day]));
  const undatedEnrollments: AcademyEnrollment[] = [];
  for (const enrollment of active) {
    if (!enrollment.dueDate) undatedEnrollments.push(enrollment);
    else byDay.get(enrollment.dueDate.slice(0, 10))?.enrollments.push(enrollment);
  }
  for (const certificate of certificates) byDay.get(certificate.validUntil!.slice(0, 10))?.certificates.push(certificate);
  const compareEnrollment = (a: AcademyEnrollment, b: AcademyEnrollment) => a.participant.name.localeCompare(b.participant.name, 'de-DE') || a.content.title.localeCompare(b.content.title, 'de-DE');
  for (const day of days) {
    day.enrollments.sort(compareEnrollment);
    day.certificates.sort((a, b) => a.participantName.localeCompare(b.participantName, 'de-DE'));
  }
  return {
    month, days, undatedEnrollments: undatedEnrollments.sort(compareEnrollment),
    expiringCertificates: certificates.filter(certificate => certificate.validUntil!.slice(0, 10) <= academyAddDays(today, 30))
      .sort((a, b) => a.validUntil!.localeCompare(b.validUntil!) || a.participantName.localeCompare(b.participantName, 'de-DE')),
  };
}

/** A UI explanation only. SQL repeats every eligibility and access check atomically. */
export function academyRenewalEligibility(source: AcademyEnrollment, courses: AcademyCourse[], enrollments: AcademyEnrollment[]): { course: AcademyCourse | null; reason: string | null } {
  const course = courses.find(entry => entry.id === source.courseId && entry.status === 'published' && entry.publishedVersionId) ?? null;
  const reject = (reason: string) => ({ course, reason });
  if (!(source.state === 'completed' || (source.state === 'cancelled' && source.previousEnrollmentId))) return reject('Diese Teilnahme kann noch nicht erneut zugewiesen werden.');
  if (source.nextEnrollmentId || enrollments.some(entry => entry.previousEnrollmentId === source.id)) return reject('Eine Folgeschulung wurde bereits angelegt.');
  if (!course) return reject('Veröffentlichen Sie zuerst eine aktuelle Kursfassung.');
  if (!course.content.audiences.includes(source.participant.kind)) return reject('Die aktuelle Kursfassung ist für diese Zielgruppe nicht vorgesehen.');
  // Portal availability comes from today's participant directory, never the historical enrollment snapshot.
  const samePersonCourse = enrollments.filter(entry => entry.id !== source.id && coursePersonKey(entry) === coursePersonKey(source));
  if (samePersonCourse.some(entry => !['completed', 'cancelled'].includes(entry.state))) return reject('Für diese Person läuft bereits eine Teilnahme an diesem Kurs.');
  const sourceCompletedAt = Date.parse(source.completedAt ?? source.assignedAt);
  const sourceAssignedAt = Date.parse(source.assignedAt);
  if (samePersonCourse.some(entry => {
    if (entry.state !== 'completed' || !entry.completedAt) return false;
    const completedAt = Date.parse(entry.completedAt);
    const assignedAt = Date.parse(entry.assignedAt);
    return completedAt > sourceCompletedAt || (completedAt === sourceCompletedAt
      && (assignedAt > sourceAssignedAt || (assignedAt === sourceAssignedAt && entry.id > source.id)));
  })) return reject('Verwenden Sie den jüngsten Abschluss für die nächste Folgeschulung.');
  return { course, reason: null };
}
