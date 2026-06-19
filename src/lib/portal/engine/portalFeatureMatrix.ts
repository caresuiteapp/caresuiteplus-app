import type { PortalFeature, PortalModuleKey } from '@/lib/portal/types';

/** Static feature matrix — mirrors migration 0099 seed (offline + demo fallback). */
export const PORTAL_FEATURE_MATRIX: PortalFeature[] = [
  { moduleKey: 'assist', featureKey: 'appointments', label: 'Termine', description: 'Assist-Termine und Besuche', navGroup: 'module', sortOrder: 10 },
  { moduleKey: 'assist', featureKey: 'messages', label: 'Nachrichten', description: 'Nachrichten an das Assist-Team', navGroup: 'global', sortOrder: 20 },
  { moduleKey: 'assist', featureKey: 'documents', label: 'Dokumente', description: 'Freigegebene Assist-Dokumente', navGroup: 'global', sortOrder: 30 },
  { moduleKey: 'assist', featureKey: 'betreuung', label: 'Betreuung', description: 'Ihr Assist-Betreuungsteam', navGroup: 'module', sortOrder: 15 },
  { moduleKey: 'assist', featureKey: 'trips', label: 'Begleitungen', description: 'Geplante Assist-Begleitungen', navGroup: 'module', sortOrder: 40 },
  { moduleKey: 'assist', featureKey: 'care_team', label: 'Betreuungsteam', description: 'Ihr Assist-Betreuungsteam', navGroup: 'module', sortOrder: 50 },
  { moduleKey: 'assist', featureKey: 'budget', label: 'Budget', description: 'Entlastungs- und Verhinderungspflege', navGroup: 'module', sortOrder: 55 },
  { moduleKey: 'assist', featureKey: 'nachweise', label: 'Nachweise', description: 'Leistungsnachweise und Belege', navGroup: 'module', sortOrder: 60 },
  { moduleKey: 'assist', featureKey: 'anfragen', label: 'Anfragen', description: 'Ihre Portal-Anfragen', navGroup: 'module', sortOrder: 65 },
  { moduleKey: 'assist', featureKey: 'hilfe', label: 'Hilfe', description: 'Hilfe und Kontakt zum Pflegebüro', navGroup: 'module', sortOrder: 70 },
  { moduleKey: 'pflege', featureKey: 'appointments', label: 'Termine', description: 'Pflege-Termine und Hausbesuche', navGroup: 'module', sortOrder: 10 },
  { moduleKey: 'pflege', featureKey: 'care_plan', label: 'Pflegeplan', description: 'Aktueller Pflegeplan', navGroup: 'module', sortOrder: 20 },
  { moduleKey: 'pflege', featureKey: 'vitals', label: 'Vitalwerte', description: 'Freigegebene Vitalwerte', navGroup: 'module', sortOrder: 30 },
  { moduleKey: 'pflege', featureKey: 'medications', label: 'Medikation', description: 'Medikationsplan', navGroup: 'module', sortOrder: 40 },
  { moduleKey: 'pflege', featureKey: 'messages', label: 'Nachrichten', description: 'Nachrichten an die Pflege', navGroup: 'global', sortOrder: 50 },
  { moduleKey: 'pflege', featureKey: 'documents', label: 'Dokumente', description: 'Pflege-Dokumente', navGroup: 'global', sortOrder: 60 },
  { moduleKey: 'stationaer', featureKey: 'appointments', label: 'Bewohnertermine', description: 'Termine in der Einrichtung', navGroup: 'module', sortOrder: 10 },
  { moduleKey: 'stationaer', featureKey: 'meals', label: 'Verpflegung', description: 'Speiseplan und Essenswünsche', navGroup: 'module', sortOrder: 20 },
  { moduleKey: 'stationaer', featureKey: 'activities', label: 'Aktivitäten', description: 'Freizeit- und Gruppenangebote', navGroup: 'module', sortOrder: 30 },
  { moduleKey: 'stationaer', featureKey: 'room', label: 'Zimmer', description: 'Zimmer- und Wohnbereichsinformationen', navGroup: 'module', sortOrder: 40 },
  { moduleKey: 'stationaer', featureKey: 'messages', label: 'Nachrichten', description: 'Nachrichten an die Einrichtung', navGroup: 'global', sortOrder: 50 },
  { moduleKey: 'stationaer', featureKey: 'documents', label: 'Dokumente', description: 'Einrichtungs-Dokumente', navGroup: 'global', sortOrder: 60 },
  { moduleKey: 'beratung', featureKey: 'consultations', label: 'Beratungstermine', description: 'Geplante Beratungsgespräche', navGroup: 'module', sortOrder: 10 },
  { moduleKey: 'beratung', featureKey: 'cases', label: 'Beratungsfälle', description: 'Laufende Beratungsfälle', navGroup: 'module', sortOrder: 20 },
  { moduleKey: 'beratung', featureKey: 'follow_ups', label: 'Nachsorge', description: 'Follow-up-Termine', navGroup: 'module', sortOrder: 30 },
  { moduleKey: 'beratung', featureKey: 'messages', label: 'Nachrichten', description: 'Nachrichten an die Beratung', navGroup: 'global', sortOrder: 40 },
  { moduleKey: 'beratung', featureKey: 'documents', label: 'Dokumente', description: 'Beratungs-Dokumente', navGroup: 'global', sortOrder: 50 },
];

export function getFeaturesForModules(modules: PortalModuleKey[]): PortalFeature[] {
  const moduleSet = new Set<PortalModuleKey | 'global'>(modules);
  return PORTAL_FEATURE_MATRIX.filter((f) => moduleSet.has(f.moduleKey));
}

export function getFeatureLabel(moduleKey: PortalModuleKey, featureKey: string): string {
  return (
    PORTAL_FEATURE_MATRIX.find(
      (f) => f.moduleKey === moduleKey && f.featureKey === featureKey,
    )?.label ?? featureKey
  );
}
