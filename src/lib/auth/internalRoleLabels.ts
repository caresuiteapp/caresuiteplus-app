import type { InternalRoleKey } from './auth.types';

export const INTERNAL_ROLE_LABELS: Record<InternalRoleKey, string> = {
  owner: 'Inhaber:in',
  management: 'Leitung/Management',
  pdl: 'Pflegedienstleitung',
  administration: 'Verwaltung',
  billing: 'Abrechnung',
  quality_management: 'Qualitätsmanagement',
  team_lead: 'Teamleitung',
  dispatcher: 'Disposition',
  employee: 'Mitarbeiter:in',
  readonly: 'Nur Lesen',
};

export function getInternalRoleLabel(roleKey: InternalRoleKey): string {
  return INTERNAL_ROLE_LABELS[roleKey] ?? roleKey;
}
