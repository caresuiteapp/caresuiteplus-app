import type {
  MedicalCatalogLicenseStatus,
  MedicalCatalogSourceEntry,
  MedicalCatalogSourceKey,
} from '@/types/medical';

export const MEDICAL_CATALOG_SOURCE_REGISTRY: MedicalCatalogSourceEntry[] = [
  {
    sourceKey: 'icd10_gm',
    label: 'ICD-10-GM',
    description: 'Diagnoseschlüssel — Kodierhilfe, Dokumentation als ärztliche Angabe',
    licenseStatus: 'public',
    isSearchEnabled: true,
    isImportEnabled: true,
    mdrRiskNote: 'Kodierhilfe — keine Diagnoseentscheidung.',
    connectIntegrationKey: 'icd10_gm',
  },
  {
    sourceKey: 'snomed_ct',
    label: 'SNOMED CT',
    description: 'Klinische Terminologie — vorbereitet, Lizenz erforderlich',
    licenseStatus: 'licensed_required',
    isSearchEnabled: false,
    isImportEnabled: false,
    mdrRiskNote: 'Nutzung nur mit gültiger SNOMED-Lizenz.',
    connectIntegrationKey: 'snomed_ct',
  },
  {
    sourceKey: 'loinc',
    label: 'LOINC',
    description: 'Labor-/Vitalwert-Codes — vorbereitet, Lizenz erforderlich',
    licenseStatus: 'licensed_required',
    isSearchEnabled: false,
    isImportEnabled: false,
    mdrRiskNote: 'Nur Dokumentationshilfe bei gültiger Lizenz.',
    connectIntegrationKey: 'loinc',
  },
  {
    sourceKey: 'ucum',
    label: 'UCUM',
    description: 'Einheiten-Codes — öffentliche Referenz',
    licenseStatus: 'public',
    isSearchEnabled: true,
    isImportEnabled: true,
    mdrRiskNote: 'Einheitenreferenz — keine klinische Bewertung.',
    connectIntegrationKey: 'ucum',
  },
  {
    sourceKey: 'atc_ddd',
    label: 'ATC/DDD',
    description: 'WHO ATC/DDD — vorbereitet, Lizenz erforderlich',
    licenseStatus: 'licensed_required',
    isSearchEnabled: false,
    isImportEnabled: false,
    mdrRiskNote: 'Stammdatenreferenz — keine Therapieempfehlung.',
    connectIntegrationKey: 'atc_ddd',
  },
  {
    sourceKey: 'pzn_ifa',
    label: 'PZN/IFA',
    description: 'Pharmazentralnummer — Anbieter/Lizenz erforderlich',
    licenseStatus: 'provider_required',
    isSearchEnabled: false,
    isImportEnabled: false,
    mdrRiskNote: 'Import nur mit IFA-Lizenz und Anbietervertrag.',
    connectIntegrationKey: 'pzn_ifa',
  },
  {
    sourceKey: 'rote_liste',
    label: 'Rote Liste',
    description: 'ABDATA Rote Liste — geschützte Datenbank',
    licenseStatus: 'licensed_required',
    isSearchEnabled: false,
    isImportEnabled: false,
    mdrRiskNote: 'Geschützte Datenbank — ohne Lizenz gesperrt.',
    connectIntegrationKey: 'rote_liste',
  },
  {
    sourceKey: 'abdata',
    label: 'ABDATA',
    description: 'ABDATA Arzneimitteldaten — ohne Lizenz deaktiviert',
    licenseStatus: 'disabled',
    isSearchEnabled: false,
    isImportEnabled: false,
    mdrRiskNote: 'Ohne Lizenz deaktiviert — kein Import.',
    connectIntegrationKey: 'abdata',
  },
  {
    sourceKey: 'bfarm_am',
    label: 'BfArM Arzneimitteldaten',
    description: 'Öffentliche BfArM-Stammdaten — Medikationsübersicht',
    licenseStatus: 'public',
    isSearchEnabled: true,
    isImportEnabled: true,
    mdrRiskNote: 'Stammdatenübersicht — keine Medikationsentscheidung.',
    connectIntegrationKey: 'bfarm_am',
  },
];

export function getMedicalCatalogSource(
  sourceKey: MedicalCatalogSourceKey,
): MedicalCatalogSourceEntry | undefined {
  return MEDICAL_CATALOG_SOURCE_REGISTRY.find((entry) => entry.sourceKey === sourceKey);
}

export function listMedicalCatalogSourcesByLicense(
  status: MedicalCatalogLicenseStatus,
): MedicalCatalogSourceEntry[] {
  return MEDICAL_CATALOG_SOURCE_REGISTRY.filter((entry) => entry.licenseStatus === status);
}

export function isMedicalCatalogSourceUsable(sourceKey: MedicalCatalogSourceKey): boolean {
  const entry = getMedicalCatalogSource(sourceKey);
  if (!entry) return false;
  if (entry.licenseStatus === 'disabled') return false;
  if (entry.licenseStatus === 'licensed_required' || entry.licenseStatus === 'provider_required') {
    return false;
  }
  return entry.isSearchEnabled || entry.isImportEnabled;
}

export function countProtectedMedicalCatalogSources(): number {
  return MEDICAL_CATALOG_SOURCE_REGISTRY.filter(
    (entry) =>
      entry.licenseStatus === 'licensed_required' ||
      entry.licenseStatus === 'provider_required' ||
      entry.licenseStatus === 'disabled',
  ).length;
}

export function getMedicalCatalogSourcesRequiringLicense(): MedicalCatalogSourceEntry[] {
  return MEDICAL_CATALOG_SOURCE_REGISTRY.filter(
    (entry) =>
      entry.licenseStatus === 'licensed_required' ||
      entry.licenseStatus === 'provider_required' ||
      entry.licenseStatus === 'disabled',
  );
}
