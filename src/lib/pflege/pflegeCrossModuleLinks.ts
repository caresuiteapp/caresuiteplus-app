/**
 * Consistent cross-module navigation links for Pflege detail and form screens.
 */
import type { PermissionKey } from '@/types/permissions';
export type PflegeCrossModuleContext =
  | 'care-plan'
  | 'vital-reading'
  | 'vital-create'
  | 'sis-assessment'
  | 'sis-form'
  | 'medication'
  | 'wound'
  | 'care-documentation';

export type PflegeCrossModuleLink = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: string;
};

type LinkDef = PflegeCrossModuleLink;
export type CarePlanLinkScope = {
  clientId: string;
  carePlanId: string;
  can: (permission: PermissionKey) => boolean;
};

const LINK_CATALOG: Record<string, LinkDef> = {
  plans: {
    id: 'plans',
    label: 'Pflegepläne',
    description: 'Pläne, Aufgaben und Gültigkeit',
    href: '/pflege/plans',
    icon: '📋',
  },
  vitals: {
    id: 'vitals',
    label: 'Vitalwerte',
    description: 'Messungen und Fälligkeiten',
    href: '/pflege/vitalwerte',
    icon: '❤️',
  },
  sis: {
    id: 'sis',
    label: 'SIS-Assessments',
    description: 'Strukturierte Informationssammlung',
    href: '/pflege/sis',
    icon: '📊',
  },
  medication: {
    id: 'medication',
    label: 'Medikation',
    description: 'Verordnungen und Einnahmezeiten',
    href: '/pflege/medikation',
    icon: '💊',
  },
  wounds: {
    id: 'wounds',
    label: 'Wunddokumentation',
    description: 'Wundfälle und Verlauf',
    href: '/pflege/wunddokumentation',
    icon: '🩹',
  },
  documentation: {
    id: 'documentation',
    label: 'Pflegedokumentation',
    description: 'Nachweise und Signaturen',
    href: '/pflege/dokumentation',
    icon: '📝',
  },
  shifts: {
    id: 'shifts',
    label: 'Dienstpläne',
    description: 'Schichtplanung und Einsätze',
    href: '/pflege/dienstplaene',
    icon: '📅',
  },
  reports: {
    id: 'reports',
    label: 'Auswertungen',
    description: 'KPIs und Kennzahlen',
    href: '/pflege/auswertungen',
    icon: '📈',
  },
};

const CONTEXT_ORDER: Record<PflegeCrossModuleContext, string[]> = {
  'care-plan': ['vitals', 'sis', 'medication', 'wounds', 'documentation'],
  'vital-reading': ['plans', 'sis', 'documentation', 'medication'],
  'vital-create': ['plans', 'vitals', 'sis', 'documentation'],
  'sis-assessment': ['plans', 'vitals', 'documentation', 'medication'],
  'sis-form': ['sis', 'plans', 'vitals', 'documentation'],
  medication: ['plans', 'vitals', 'wounds', 'documentation'],
  wound: ['plans', 'medication', 'vitals', 'documentation'],
  'care-documentation': ['plans', 'vitals', 'sis', 'medication'],
};

export function buildPflegeCrossModuleLinks(context: PflegeCrossModuleContext, scope?: CarePlanLinkScope): PflegeCrossModuleLink[] {
  if (context === 'care-plan' && scope) {
    const client = encodeURIComponent(scope.clientId);
    const plan = encodeURIComponent(scope.carePlanId);
    const entries: { link: PflegeCrossModuleLink; permissions: PermissionKey[] }[] = [
      { permissions: ['pflege.plans.view'], link: { ...LINK_CATALOG.sis, label: 'Pflegeassessment und Anamnese' } },
      { permissions: ['pflege.diagnoses.view'], link: { id: 'diagnoses', label: 'Pflegediagnosen', description: 'Pflegerelevante Diagnosen und Befunde', href: '/pflege/diagnosen', icon: '🩺' } },
      { permissions: ['pflege.medications.view'], link: LINK_CATALOG.medication },
      { permissions: ['pflege.vitals.view'], link: { ...LINK_CATALOG.vitals, description: 'Messwerte, Flüssigkeitsbilanz und Glasgow-Koma-Skala' } },
      { permissions: ['pflege.evaluations.view'], link: { id: 'evaluation', label: 'Pflegeevaluation', description: 'Wirkung und Prüftermine dieses Pflegeplans', href: `/pflege/evaluation?carePlanId=${plan}`, icon: '📈' } },
      { permissions: ['pflege.documentation.view'], link: { ...LINK_CATALOG.documentation, label: 'Berichteblatt', href: `/pflege/dokumentation?clientId=${client}` } },
      { permissions: ['pflege.proofs.view'], link: { id: 'proofs', label: 'Tätigkeitsnachweise', description: 'Geplante und dokumentierte Pflegeleistungen', href: '/pflege/leistungsnachweise', icon: '✓' } },
      { permissions: ['pflege.risks.view'], link: { id: 'risks', label: 'Risikobewertung', description: 'Pflegerelevante Risiken und Verlauf', href: '/pflege/risiken', icon: '☷' } },
      { permissions: ['pflege.wounds.view'], link: { ...LINK_CATALOG.wounds, description: 'Wundverlauf und Norton-/Braden-Erfassung' } },
      { permissions: ['office.clients.view', 'inventory.view', 'inventory.audit_view'], link: { id: 'supplies', label: 'Hygiene und Pflegeprodukte', description: 'Material und fallbezogene Hygiene', href: `/pflege/inventar?clientId=${client}`, icon: '▤' } },
      { permissions: ['office.documents.view', 'office.clients.view', 'office.clients.view_sensitive'], link: { id: 'forms', label: 'Formulare', description: 'Dokumentenvorlagen für Pflege', href: `/office/document-catalog?module=pflege&clientId=${client}`, icon: '▧' } },
    ];
    return entries.filter(entry => entry.permissions.every(scope.can)).map(entry => entry.link);
  }
  return CONTEXT_ORDER[context]
    .map((key) => LINK_CATALOG[key])
    .filter((link): link is LinkDef => link != null);
}
