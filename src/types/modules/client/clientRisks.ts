import type { TenantScopedEntity } from '../../core/base';

export type RiskLevel = 'niedrig' | 'mittel' | 'hoch' | 'kritisch';

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  niedrig: 'Niedrig',
  mittel: 'Mittel',
  hoch: 'Hoch',
  kritisch: 'Kritisch',
};

export type ClientRisk = TenantScopedEntity & {
  clientId: string;
  category: 'sturz' | 'dekubitus' | 'ernaehrung' | 'medikation' | 'verhalten' | 'sonstige';
  level: RiskLevel;
  description: string;
  mitigation: string | null;
  assessedAt: string;
  assessedBy: string | null;
};

export type ClientEmergencyPlan = TenantScopedEntity & {
  clientId: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string | null;
  doctorName: string | null;
  doctorPhone: string | null;
  hospitalPreference: string | null;
  allergies: string[];
  medications: string[];
  specialInstructions: string | null;
  dnrStatus: boolean;
};

export const RISK_CATEGORY_LABELS: Record<ClientRisk['category'], string> = {
  sturz: 'Sturzrisiko',
  dekubitus: 'Dekubitus',
  ernaehrung: 'Ernährung',
  medikation: 'Medikation',
  verhalten: 'Verhalten',
  sonstige: 'Sonstige',
};
