import type { MedicalBlockedFunctionKey } from '@/types/medical';
import { getServiceMode } from '@/lib/services/mode';
import { isMedicalCatalogSourceUsable } from './medicalCatalogRegistry';

export const MEDICAL_LIVE_WIRING_MIGRATION = '0047_medical_catalog_prepared.sql';

export const MEDICAL_PREPARED_MESSAGE =
  'Medizinische Stammdaten und Dokumentationshilfen sind vorbereitet. ' +
  'Katalogimporte geschützter Datenbanken erfordern gültige Lizenzen — keine klinischen Entscheidungen.';

/** Live-Flip bleibt false bis Remote-Migration + lizenzierte Kataloge aktiv. */
export function isMedicalCatalogLiveReady(): boolean {
  return false;
}

export function isMedicalCatalogWiringPrepared(): boolean {
  return true;
}

export const MEDICAL_BLOCKED_FUNCTIONS: readonly MedicalBlockedFunctionKey[] = [
  'diagnosis_ai',
  'therapy_recommendation',
  'medication_decision',
  'automatic_risk_assessment',
  'treatment_recommendation',
] as const;

export const MEDICAL_BLOCKED_FUNCTION_LABELS: Record<MedicalBlockedFunctionKey, string> = {
  diagnosis_ai: 'Diagnose-KI',
  therapy_recommendation: 'Therapieempfehlung',
  medication_decision: 'Medikationsentscheidung',
  automatic_risk_assessment: 'Automatisches Risiko als medizinische Entscheidung',
  treatment_recommendation: 'Behandlungsempfehlung',
};

export function isMedicalFunctionBlocked(functionKey: MedicalBlockedFunctionKey): boolean {
  return MEDICAL_BLOCKED_FUNCTIONS.includes(functionKey);
}

export function assertMedicalFunctionAllowed(functionKey: MedicalBlockedFunctionKey): {
  ok: true;
} | { ok: false; reason: string } {
  if (isMedicalFunctionBlocked(functionKey)) {
    return {
      ok: false,
      reason: `${MEDICAL_BLOCKED_FUNCTION_LABELS[functionKey]} ist nicht vorgesehen — nur Dokumentationshilfe.`,
    };
  }
  return { ok: true };
}

/** Produktivmodus ohne Demo-Katalog — nur öffentlich freigegebene Quellen. */
export function canUseMedicalCatalogInCurrentMode(sourceKey: Parameters<typeof isMedicalCatalogSourceUsable>[0]): boolean {
  if (getServiceMode() === 'supabase' && !isMedicalCatalogLiveReady()) {
    return false;
  }
  if (getServiceMode() === 'supabase') {
    return isMedicalCatalogSourceUsable(sourceKey);
  }
  return sourceKey === 'icd10_gm' || sourceKey === 'ucum' || sourceKey === 'bfarm_am';
}

export type MedicalLiveFlipBlocker = {
  id: string;
  label: string;
  resolved: boolean;
};

export function getMedicalLiveFlipBlockers(): MedicalLiveFlipBlocker[] {
  return [
    {
      id: 'migration-0047',
      label: `Remote-Migration ${MEDICAL_LIVE_WIRING_MIGRATION} angewendet`,
      resolved: false,
    },
    {
      id: 'licensed-catalogs',
      label: 'Lizenzierte Kataloge (SNOMED, LOINC, Rote Liste) verifiziert',
      resolved: false,
    },
    {
      id: 'no-demo-catalog-production',
      label: 'Produktivmodus ohne unlizenzierte Demo-Kataloge',
      resolved: false,
    },
    {
      id: 'mdr-review',
      label: 'MDR/Medizinprodukterecht — keine klinische Entscheidungslogik',
      resolved: true,
    },
  ];
}

export function countMedicalLiveFlipBlockersRemaining(): number {
  return getMedicalLiveFlipBlockers().filter((blocker) => !blocker.resolved).length;
}
