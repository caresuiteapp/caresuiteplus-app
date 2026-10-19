import type { ShiftScheduleListItem } from './shiftScheduleDemo';

export type ShiftReleaseBoundary = Readonly<{
  suppliedRows: number;
  drafts: number;
  released: number;
  officeConfirmed: number;
  unresolvedEmployees: number;
  integrity: 'consistent' | 'untrusted';
  releaseChecks: readonly string[];
  missingPlanEvidence: readonly string[];
}>;

const RELEASE_CHECKS = Object.freeze([
  'Monatsverfügbarkeit und abgedecktes Zeitfenster',
  'Sperrzeiten und gespeicherte Abwesenheiten',
  'Überschneidungen und Standardruhezeit',
  'aktive Pflegekraft, Mandant und aktueller Zeilenstand',
]);

const MISSING_PLAN_EVIDENCE = Object.freeze([
  'eindeutige Dienstplanversion mit Gültigkeitszeitraum',
  'Veröffentlichungsbeleg des vollständigen Planstands',
  'Empfangsbestätigung der betroffenen Pflegekraft',
  'vollständig gebundene Original- und Änderungshistorie',
]);

/** Read-only boundary for the rows already delivered to the Web/Desktop list.
 * It never turns a workflow status into receipt, actual attendance, or completed work. */
export function buildShiftReleaseBoundary(items: readonly ShiftScheduleListItem[]): ShiftReleaseBoundary {
  const ids = new Set<string>();
  const tenants = new Set<string>();
  let integrity: ShiftReleaseBoundary['integrity'] = 'consistent';
  let drafts = 0;
  let released = 0;
  let officeConfirmed = 0;
  let unresolvedEmployees = 0;

  for (const item of items) {
    if (!item.id || ids.has(item.id) || !item.tenantId) integrity = 'untrusted';
    ids.add(item.id);
    if (item.tenantId) tenants.add(item.tenantId);
    if (!item.employeeId) unresolvedEmployees += 1;
    if (item.status === 'entwurf') drafts += 1;
    if (item.status === 'geplant') released += 1;
    if (item.status === 'bestaetigt') officeConfirmed += 1;
  }
  if (tenants.size > 1) integrity = 'untrusted';

  return Object.freeze({
    suppliedRows: items.length,
    drafts,
    released,
    officeConfirmed,
    unresolvedEmployees,
    integrity,
    releaseChecks: RELEASE_CHECKS,
    missingPlanEvidence: MISSING_PLAN_EVIDENCE,
  });
}
