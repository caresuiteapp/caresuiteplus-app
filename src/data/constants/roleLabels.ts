import type { RoleKey } from '@/types';

export const ROLE_LABELS: Record<RoleKey, string> = {
  business_admin: 'Geschäftsführung / Admin',
  business_manager: 'Bereichsleitung',
  billing: 'Abrechnung',
  dispatch: 'Einsatzplanung',
  nurse: 'Pflegefachkraft',
  caregiver: 'Alltagsbegleiter:in',
  counselor: 'Beratungskraft',
  akademie_admin: 'Akademie-Admin',
  employee_portal: 'Mitarbeiterportal',
  client_portal: 'Klient:innenportal',
  family_portal: 'Angehörigenportal',
};
