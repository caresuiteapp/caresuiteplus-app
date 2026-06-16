import type { RoleKey } from '@/types/core/auth';
import type {
  ComplianceRoleGroup,
  ComplianceTrainingAreaKey,
} from '@/types/modules/complianceTraining';
import { ALL_COMPLIANCE_TRAINING_AREAS } from '@/types/modules/complianceTraining';
import { hasPermission } from '@/lib/permissions';

/** Pflichtunterweisungen pro Rollengruppe (Prompt-Spezifikation) */
export const MANDATORY_COMPLIANCE_AREAS_BY_ROLE_GROUP: Record<
  ComplianceRoleGroup,
  ComplianceTrainingAreaKey[]
> = {
  caregiver_employee: [...ALL_COMPLIANCE_TRAINING_AREAS],
  office: [
    'datenschutz',
    'schweigepflicht',
    'dsgvo_grundlagen',
    'dokumentationspflicht',
    'kommunikationsregeln',
    'dienstanweisungen',
    'app_nutzung',
  ],
  billing: [
    'datenschutz',
    'schweigepflicht',
    'dsgvo_grundlagen',
    'dokumentationspflicht',
    'kommunikationsregeln',
    'dienstanweisungen',
  ],
  qm: [
    'datenschutz',
    'schweigepflicht',
    'dsgvo_grundlagen',
    'dokumentationspflicht',
    'kommunikationsregeln',
    'dienstanweisungen',
    'notfallverhalten',
  ],
  admin_owner: [...ALL_COMPLIANCE_TRAINING_AREAS],
};

export const DEFAULT_COMPLIANCE_VALIDITY_MONTHS = 12;

export const COMPLIANCE_EXPIRY_WARNING_DAYS = 30;

export function mapRoleKeyToComplianceGroup(roleKey: RoleKey | null): ComplianceRoleGroup | null {
  if (!roleKey) return null;
  switch (roleKey) {
    case 'caregiver':
    case 'nurse':
    case 'employee_portal':
    case 'dispatch':
    case 'counselor':
      return 'caregiver_employee';
    case 'billing':
      return 'billing';
    case 'business_admin':
      return 'admin_owner';
    case 'business_manager':
      return hasPermission(roleKey, 'qm.view') ? 'qm' : 'office';
    case 'akademie_admin':
      return 'office';
    default:
      return null;
  }
}

export function getMandatoryAreasForRoleGroup(group: ComplianceRoleGroup): ComplianceTrainingAreaKey[] {
  return MANDATORY_COMPLIANCE_AREAS_BY_ROLE_GROUP[group] ?? [];
}

export function buildDefaultTrainingTitle(areaKey: ComplianceTrainingAreaKey): string {
  const labels: Record<ComplianceTrainingAreaKey, string> = {
    datenschutz: 'Datenschutzunterweisung',
    schweigepflicht: 'Schweigepflichtunterweisung',
    dsgvo_grundlagen: 'DSGVO-Grundlagen',
    verhalten_haushalt: 'Verhalten im Haushalt von Klient:innen',
    dokumentationspflicht: 'Dokumentationspflicht',
    schluessel_zugang: 'Umgang mit Schlüssel/Zugang',
    notfallverhalten: 'Notfallverhalten',
    app_nutzung: 'App-Nutzung',
    kommunikationsregeln: 'Kommunikationsregeln',
    dienstanweisungen: 'Dienstanweisungen',
  };
  return labels[areaKey];
}
