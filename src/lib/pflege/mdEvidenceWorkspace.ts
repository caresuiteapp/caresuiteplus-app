import type { PflegeMdReadinessItem } from '@/types/modules/pflege';
import { woundUuid } from './woundCareDomain';

type CheckKey = keyof PflegeMdReadinessItem['checks'];
type Check = { key: CheckKey; title: string; requirement: string; gap: string };

/** The existing RPC's operational signals, not the Medical Review Board's audit criteria. */
export const mdEvidenceChecks = [
  { key: 'approvedSis', title: 'Freigegebene Informationssammlung', requirement: 'Mindestens eine freigegebene SIS im Pflegefall.', gap: 'Keine freigegebene SIS gefunden.' },
  { key: 'activeMeasures', title: 'Aktive Maßnahmen', requirement: 'Mindestens eine aktive Maßnahme in diesem Pflegeplan.', gap: 'Keine aktive Maßnahme für diesen Pflegeplan gefunden.' },
  { key: 'risksCurrent', title: 'Risikoüberprüfung', requirement: 'Für festgestellte oder unklare Risiken ist kein Prüftermin fällig oder ungeklärt.', gap: 'Mindestens ein festgestelltes oder unklares Risiko hat einen überschrittenen oder fehlenden Prüftermin.' },
  { key: 'recentEvaluation', title: 'Evaluation des Pflegeplans', requirement: 'Mindestens eine erfasste Evaluation des Plans in den letzten 90 Tagen.', gap: 'Keine erfasste Evaluation des Plans aus den letzten 90 Tagen gefunden.' },
  { key: 'recentVisit', title: 'Abgeschlossene Pflegevisite', requirement: 'Mindestens eine abgeschlossene Pflegevisite des Falls in den letzten 90 Tagen.', gap: 'Keine abgeschlossene Pflegevisite des Falls aus den letzten 90 Tagen gefunden.' },
  { key: 'signedDocumentation', title: 'Signierte Dokumentation', requirement: 'Mindestens ein signierter Eintrag mit Erfassungszeit in den letzten 30 Tagen.', gap: 'Kein signierter Eintrag mit Erfassungszeit in den letzten 30 Tagen gefunden.' },
  { key: 'deviationsClear', title: 'Kritische oder überfällige Abweichungen', requirement: 'Im Pflegefall ist keine kritische oder überfällige Abweichung offen.', gap: 'Mindestens eine kritische oder überfällige Abweichung ist noch offen.' },
] as const satisfies readonly Check[];

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

/** Never turn malformed, contradictory, or incomplete server evidence into zero/open work. */
export function readMdEvidenceRows(value: unknown): PflegeMdReadinessItem[] | null {
  if (!Array.isArray(value)) return null;
  const plans = new Set<string>();
  const clients = new Map<string, string>();
  const validated: PflegeMdReadinessItem[] = [];
  for (const row of value) {
    if (!isRecord(row) || !woundUuid(row.clientId) || !woundUuid(row.carePlanId)
      || typeof row.clientName !== 'string' || typeof row.planTitle !== 'string' || !isRecord(row.checks)
      || Object.keys(row.checks).length !== mdEvidenceChecks.length || plans.has(row.carePlanId)) return null;
    const clientName = row.clientName.trim();
    if (clients.has(row.clientId) && clients.get(row.clientId) !== clientName) return null;
    const checks = {} as PflegeMdReadinessItem['checks'];
    let passed = 0;
    for (const { key } of mdEvidenceChecks) {
      const result = row.checks[key];
      if (typeof result !== 'boolean') return null;
      checks[key] = result;
      if (result) passed++;
    }
    const ready = passed === mdEvidenceChecks.length;
    const readinessPercent = Math.round(passed * 100 / mdEvidenceChecks.length);
    if (row.ready !== ready || row.readinessPercent !== readinessPercent) return null;
    clients.set(row.clientId, clientName);
    plans.add(row.carePlanId);
    validated.push({ clientId: row.clientId, clientName, carePlanId: row.carePlanId,
      planTitle: row.planTitle.trim(), checks, ready, readinessPercent });
  }
  return validated;
}

export type MdEvidenceFilter = 'pending' | 'matched' | 'all';
export type MdEvidenceCase = { clientId: string; clientName: string; plans: PflegeMdReadinessItem[]; pendingPlans: number; totalPlans: number };

/** Each case may have several valid plans. Preserve the provenance of their plan-level signals. */
export function groupMdEvidenceCases(rows: readonly PflegeMdReadinessItem[]): MdEvidenceCase[] {
  const patients = new Map<string, MdEvidenceCase>();
  for (const plan of rows) {
    let patient = patients.get(plan.clientId);
    if (!patient) {
      patient = { clientId: plan.clientId, clientName: plan.clientName, plans: [], pendingPlans: 0, totalPlans: 0 };
      patients.set(plan.clientId, patient);
    }
    patient.plans.push(plan);
    patient.totalPlans++;
    if (!plan.ready) patient.pendingPlans++;
  }
  const byName = new Intl.Collator('de-DE', { sensitivity: 'base' });
  const cases = Array.from(patients.values());
  for (const item of cases) {
    item.plans.sort((left, right) => Number(left.ready) - Number(right.ready)
      || byName.compare(left.planTitle, right.planTitle) || left.carePlanId.localeCompare(right.carePlanId));
  }
  // The RPC sorts by last name then first name. The display name is not
  // sufficient to reproduce that order, especially for compound surnames.
  return cases.sort((left, right) => Number(right.pendingPlans > 0) - Number(left.pendingPlans > 0));
}

const searchText = (value: string) => value.toLocaleLowerCase('de-DE').normalize('NFD').replace(/\p{M}/gu, '');

export function filterMdEvidenceCases(cases: readonly MdEvidenceCase[], find: string, filter: MdEvidenceFilter): MdEvidenceCase[] {
  const terms = searchText(find.trim()).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return cases.flatMap(item => {
    if ((filter === 'pending' && !item.pendingPlans) || (filter === 'matched' && item.pendingPlans > 0)) return [];
    const plans = item.plans.filter(plan => {
      if (filter === 'pending' && plan.ready) return false;
      const searchable = searchText(`${item.clientName} ${plan.planTitle}`);
      return terms.every(term => searchable.includes(term));
    });
    return plans.length ? [{ ...item, plans }] : [];
  });
}

export type MdEvidenceTarget = { base: string; path: string; label: string };
const planTarget = (plan: PflegeMdReadinessItem): MdEvidenceTarget => ({
  base: '/pflege/plans', path: `/pflege/plans/${plan.carePlanId}`, label: 'Pflegeplan öffnen',
});

/** Exact links when the target actually supports the case; general lists are explicitly labelled. */
export function mdEvidenceTarget(plan: PflegeMdReadinessItem, check: CheckKey | 'plan' | 'case'): MdEvidenceTarget | null {
  if (!woundUuid(plan.clientId) || !woundUuid(plan.carePlanId)) return null;
  switch (check) {
    case 'case': return { base: '/pflege/klienten', path: `/pflege/klienten/${plan.clientId}`, label: 'Pflegeakte öffnen' };
    case 'plan':
    case 'activeMeasures': return planTarget(plan);
    case 'approvedSis': return { base: '/pflege/sis', path: '/pflege/sis', label: 'SIS-Übersicht öffnen' };
    case 'risksCurrent': return { base: '/pflege/risiken', path: '/pflege/risiken', label: 'Risikoübersicht öffnen' };
    case 'recentEvaluation': return { base: '/pflege/evaluation', path: `/pflege/evaluation?carePlanId=${plan.carePlanId}`, label: 'Evaluationen dieses Plans öffnen' };
    case 'recentVisit': return { base: '/pflege/visiten', path: `/pflege/visiten?clientId=${plan.clientId}`, label: 'Visiten dieses Falls öffnen' };
    case 'signedDocumentation': return { base: '/pflege/dokumentation', path: `/pflege/dokumentation?clientId=${plan.clientId}`, label: 'Dokumentation dieses Falls öffnen' };
    case 'deviationsClear': return { base: '/pflege/abweichungen', path: '/pflege/abweichungen', label: 'Abweichungsübersicht öffnen' };
  }
}
