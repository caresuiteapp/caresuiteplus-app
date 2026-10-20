export type WorktimeTechnicalRule = Readonly<{
  key: 'daily_net' | 'pause_6h' | 'pause_9h' | 'rest';
  label: string;
  minutes: number;
  implementation: readonly string[];
}>;

export type WorktimeOfficialSource = Readonly<{
  section: '§ 3 ArbZG' | '§ 4 ArbZG' | '§ 5 ArbZG' | '§ 7 ArbZG';
  url: string;
}>;

export type WorktimeRuleEvidence = Readonly<{
  reviewedOn: '2026-10-12';
  reviewScope: 'amtliche Fundstellen, keine Rechtsfreigabe';
  technicalRules: readonly WorktimeTechnicalRule[];
  officialSources: readonly WorktimeOfficialSource[];
  bindingBasisId: null;
  bindingBasisVersion: null;
  exceptionApproved: false;
  legalApproval: false;
  missingEvidence: readonly string[];
}>;

const TECHNICAL_RULES: readonly WorktimeTechnicalRule[] = Object.freeze([
  Object.freeze({
    key: 'daily_net' as const,
    label: 'höchstens zehn Stunden geplante Nettoarbeitszeit',
    minutes: 600,
    implementation: Object.freeze(['Pflege-Schichtvalidierung', 'WFM-Regelwarnung']),
  }),
  Object.freeze({
    key: 'pause_6h' as const,
    label: 'ab mehr als sechs Stunden mindestens 30 Minuten Pause',
    minutes: 30,
    implementation: Object.freeze(['Pflege-Schichtvalidierung', 'WFM-Regelwarnung']),
  }),
  Object.freeze({
    key: 'pause_9h' as const,
    label: 'ab mehr als neun Stunden mindestens 45 Minuten Pause',
    minutes: 45,
    implementation: Object.freeze(['Pflege-Schichtvalidierung', 'WFM-Regelwarnung']),
  }),
  Object.freeze({
    key: 'rest' as const,
    label: 'elf Stunden Standardruhezeit zwischen Schichten',
    minutes: 660,
    implementation: Object.freeze(['Dienstplanfreigabe', 'WFM-Regelwarnung']),
  }),
]);

const OFFICIAL_SOURCES: readonly WorktimeOfficialSource[] = Object.freeze([
  Object.freeze({ section: '§ 3 ArbZG' as const, url: 'https://www.gesetze-im-internet.de/arbzg/__3.html' }),
  Object.freeze({ section: '§ 4 ArbZG' as const, url: 'https://www.gesetze-im-internet.de/arbzg/__4.html' }),
  Object.freeze({ section: '§ 5 ArbZG' as const, url: 'https://www.gesetze-im-internet.de/arbzg/__5.html' }),
  Object.freeze({ section: '§ 7 ArbZG' as const, url: 'https://www.gesetze-im-internet.de/arbzg/__7.html' }),
]);

const MISSING_EVIDENCE = Object.freeze([
  'für Betrieb und Beschäftigte geltende versionierte Grundlage mit Gültigkeitszeitraum',
  'Ausgleichszeitraum und durchschnittliche werktägliche Arbeitszeit',
  'tarifliche, betriebliche oder behördliche Ausnahme mit Umfang, Zeitraum und Berechtigung',
  'an jede Prüfung gebundene Regelversion und unveränderliche Originalhistorie',
]);

/** Read-only inventory of the currently encoded Web/Desktop planning defaults.
 * Official source pointers document the review target, not legal applicability or approval. */
export function buildWorktimeRuleEvidence(): WorktimeRuleEvidence {
  return Object.freeze({
    reviewedOn: '2026-10-12',
    reviewScope: 'amtliche Fundstellen, keine Rechtsfreigabe',
    technicalRules: TECHNICAL_RULES,
    officialSources: OFFICIAL_SOURCES,
    bindingBasisId: null,
    bindingBasisVersion: null,
    exceptionApproved: false,
    legalApproval: false,
    missingEvidence: MISSING_EVIDENCE,
  });
}
