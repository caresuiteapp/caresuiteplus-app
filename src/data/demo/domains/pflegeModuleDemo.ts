import type { WorkflowStatus } from '@/types';
import { getDemoSisAssessments as getDemoSisAssessmentRecords } from '../sisAssessments';
import { DEMO_TENANT_ID } from '../tenant';

export type PflegeModuleSettings = {
  vitalRemindersEnabled: boolean;
  sisIntegrationEnabled: boolean;
  portalVitalsEnabled: boolean;
  autoPlanReviewEnabled: boolean;
  woundDocAlertsEnabled: boolean;
};

export type SisAssessmentListItem = {
  id: string;
  tenantId: string;
  clientName: string;
  carePlanTitle: string;
  assessedAt: string;
  nextDueAt: string | null;
  status: WorkflowStatus;
  domainCount: number;
  preparedOnly: boolean;
};

export type PflegeReportKpi = {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  accentColor: string;
};

const DEFAULT_SETTINGS: PflegeModuleSettings = {
  vitalRemindersEnabled: true,
  sisIntegrationEnabled: true,
  portalVitalsEnabled: true,
  autoPlanReviewEnabled: false,
  woundDocAlertsEnabled: true,
};

const CARE_PLAN_TITLES = [
  'Grundpflege & Mobilisation',
  'Medikamentenmanagement & Wundversorgung',
  'Angehörigenentlastung & Haushalt',
  'Demenz — Tagesstruktur',
  'Sturzprophylaxe',
  'Ernährung & Trinken',
];

function buildSisListItems(): SisAssessmentListItem[] {
  return getDemoSisAssessmentRecords().map((assessment, i) => ({
    id: assessment.id,
    tenantId: assessment.tenantId,
    clientName: assessment.clientName,
    carePlanTitle: CARE_PLAN_TITLES[i % CARE_PLAN_TITLES.length]!,
    assessedAt: assessment.assessedAt,
    nextDueAt: assessment.nextReviewAt,
    status: assessment.status,
    domainCount: 4 + (i % 3),
    preparedOnly: false,
  }));
}

const REPORT_KPIS: PflegeReportKpi[] = [
  { id: 'pkpi-1', label: 'Aktive Pläne', value: 8, subValue: 'Demo-Mandant', accentColor: '#34C759' },
  { id: 'pkpi-2', label: 'Fällige Vitalwerte', value: 5, subValue: 'Diese Woche', accentColor: '#FF9500' },
  { id: 'pkpi-3', label: 'SIS fällig', value: 2, subValue: 'Demo-funktional', accentColor: '#62F3FF' },
  { id: 'pkpi-4', label: 'Qualitätsindikatoren', value: '4,7', subValue: 'Ø Bewertung', accentColor: '#AF52DE' },
];

export function getDemoPflegeSettings(): PflegeModuleSettings {
  return { ...DEFAULT_SETTINGS };
}

export function getDemoSisAssessments(): SisAssessmentListItem[] {
  return buildSisListItems();
}

export function getDemoPflegeReportKpis(): PflegeReportKpi[] {
  return REPORT_KPIS.map((item) => ({ ...item }));
}
