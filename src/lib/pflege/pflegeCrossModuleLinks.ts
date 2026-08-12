/**
 * Consistent cross-module navigation links for Pflege detail and form screens.
 */
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
    description: 'Wundfälle und BodyMap',
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

export function buildPflegeCrossModuleLinks(context: PflegeCrossModuleContext): PflegeCrossModuleLink[] {
  return CONTEXT_ORDER[context]
    .map((key) => LINK_CATALOG[key])
    .filter((link): link is LinkDef => link != null);
}
