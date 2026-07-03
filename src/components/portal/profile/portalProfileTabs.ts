import type { PortalEmployeeProfileTabKey } from '@/types/portal/employeePersonnel';

export const PORTAL_EMPLOYEE_PROFILE_TABS: Array<{ key: PortalEmployeeProfileTabKey; label: string }> = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'master_data', label: 'Stammdaten' },
  { key: 'contact', label: 'Kontakt' },
  { key: 'employment', label: 'Anstellung' },
  { key: 'compensation', label: 'Vergütung & Bank' },
  { key: 'tax_social', label: 'Steuer & SV' },
  { key: 'secondary_employment', label: 'Mehrfachbeschäftigung' },
  { key: 'roles_permissions', label: 'Rollen & Rechte' },
  { key: 'qualifications', label: 'Qualifikationen' },
  { key: 'documents', label: 'Dokumente' },
  { key: 'portal', label: 'Portal' },
  { key: 'deployability', label: 'Einsatzfähigkeit' },
  { key: 'work_materials', label: 'Arbeitsmaterial' },
  { key: 'audit', label: 'Verlauf' },
];

export const OFFICE_PROFILE_HINT =
  'Änderungen an Ihren Stammdaten nimmt das Office vor. Bitte wenden Sie sich bei Fragen an Ihr Pflegebüro.';

export const PORTAL_PROFILE_EMPTY_MESSAGES: Partial<Record<PortalEmployeeProfileTabKey, string>> = {
  overview: 'Keine Daten hinterlegt.',
  master_data: 'Keine Daten hinterlegt.',
  contact: 'Keine Daten hinterlegt.',
  employment: 'Keine Daten hinterlegt.',
  compensation: 'Keine Daten hinterlegt.',
  tax_social: 'Keine Daten hinterlegt.',
  secondary_employment: 'Keine Daten hinterlegt.',
  roles_permissions: 'Keine Daten hinterlegt.',
  qualifications: 'Keine Daten hinterlegt.',
  documents: 'Keine für Sie freigegebenen Dokumente vorhanden.',
  portal: 'Keine Daten hinterlegt.',
  deployability: 'Keine Daten hinterlegt.',
  work_materials: 'Keine Daten hinterlegt.',
  audit: 'Noch keine sichtbaren Änderungen vorhanden.',
};
