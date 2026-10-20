import { getConnectCategories, getConnectCategory } from './connectCatalog';
import type {
  ConnectCategory,
  ConnectComplianceRisk,
  ConnectIntegration,
  ConnectReleaseStatus,
  ConnectRoadmapEntry,
  ConnectRoadmapMetadata,
  ConnectRoadmapPhase,
} from '@/types/modules/connect';

type RoadmapKey = `${string}.${string}` | string;

function meta(
  phase: ConnectRoadmapPhase,
  priority: number,
  release_status: ConnectReleaseStatus,
  revenue_relevance: ConnectRoadmapMetadata['revenue_relevance'],
  compliance_risk: ConnectComplianceRisk,
  implementation_complexity: ConnectRoadmapMetadata['implementation_complexity'],
  provider_dependency: ConnectRoadmapMetadata['provider_dependency'],
  next_step: string,
): ConnectRoadmapMetadata {
  return {
    phase,
    priority,
    release_status,
    revenue_relevance,
    compliance_risk,
    implementation_complexity,
    provider_dependency,
    next_step,
  };
}

/** Kategorie-Defaults — Integrationen können spezifisch überschreiben. */
export const CONNECT_CATEGORY_ROADMAP: Record<string, ConnectRoadmapMetadata> = {
  billing: meta(
    1,
    10,
    'design',
    'high',
    'high',
    'high',
    'regulated',
    'Kostenträgerdatei-Import und IK-Validierung als Kern-Exportpfad spezifizieren.',
  ),
  accounting: meta(
    1,
    20,
    'discovery',
    'high',
    'medium',
    'medium',
    'multiple',
    'DATEV-/Lexware-/sevDesk-Exportformate und GoBD-Audit-Trail abstimmen.',
  ),
  payments: meta(
    1,
    30,
    'discovery',
    'high',
    'medium',
    'medium',
    'multiple',
    'Stripe-, GoCardless- und Mollie-Sandbox ohne produktive Buchung vorbereiten.',
  ),
  communication_channels: meta(
    1,
    50,
    'design',
    'medium',
    'medium',
    'medium',
    'multiple',
    'E-Mail-, SMS- und Push-Kanäle mit Mandanten-Opt-in und AVV-Vorlagen definieren.',
  ),
  routes_gps: meta(
    1,
    40,
    'sandbox_ready',
    'medium',
    'low',
    'medium',
    'multiple',
    'Google Maps/HERE-Routing für Tourenplanung als Read-only-Sandbox evaluieren.',
  ),
  documents_signatures: meta(
    1,
    35,
    'sandbox_ready',
    'medium',
    'medium',
    'high',
    'multiple',
    'PDF-/Archiv-Modul und Signatur-Provider-Evaluation starten.',
  ),
  medical_data: meta(
    1,
    25,
    'development',
    'medium',
    'high',
    'medium',
    'regulated',
    'BfArM ICD-10-GM-Import stabilisieren; weitere Kataloge Phase 2.',
  ),
  ti_kim: meta(
    2,
    100,
    'discovery',
    'medium',
    'critical',
    'high',
    'regulated',
    'KIM-ready und TI-Gateway-Partner rechtlich klären — kein Live-TI ohne Zertifizierung.',
  ),
  hr_payroll: meta(
    2,
    200,
    'planned',
    'low',
    'medium',
    'medium',
    'multiple',
    'Lohn-Connectors nach Abrechnungskern priorisieren.',
  ),
  academy_integrations: meta(
    3,
    300,
    'planned',
    'medium',
    'low',
    'medium',
    'multiple',
    'SCORM/xAPI-Anbindung für Schulungspartner vorbereiten.',
  ),
  marketplace: meta(
    3,
    310,
    'planned',
    'high',
    'medium',
    'high',
    'multiple',
    'Partner-Onboarding und Umsatzmodell für Marktplatz-Kategorien definieren.',
  ),
};

/** Integrationsspezifische Roadmap — überschreibt Kategorie-Defaults. */
export const CONNECT_INTEGRATION_ROADMAP: Record<RoadmapKey, ConnectRoadmapMetadata> = {
  'billing.gkv': meta(
    1,
    11,
    'design',
    'high',
    'critical',
    'high',
    'regulated',
    'GKV-Abrechnungsdatenaustausch mit Kostenträgerdatei-Modul verzahnen.',
  ),
  'billing.sgb_xi': meta(
    1,
    12,
    'design',
    'high',
    'critical',
    'high',
    'regulated',
    'SGB-XI-Leistungsarten und IK-Prüfung in Exportpipeline einplanen.',
  ),
  'billing.sgb_v': meta(
    1,
    13,
    'planned',
    'high',
    'critical',
    'high',
    'regulated',
    'SGB-V-Pfade nach GKV-Kern priorisieren.',
  ),
  'billing.pflegekassen': meta(
    1,
    14,
    'design',
    'high',
    'high',
    'high',
    'regulated',
    'Pflegekassen-Stammdaten aus Kostenträgerdateien ableiten.',
  ),
  'billing.krankenkassen': meta(
    1,
    15,
    'planned',
    'high',
    'high',
    'high',
    'regulated',
    'Krankenkassen-Kommunikation an Abrechnungszentrum-Export anbinden.',
  ),
  'billing.kostentraegerdateien': meta(
    1,
    8,
    'development',
    'high',
    'high',
    'high',
    'regulated',
    'GKV-Kostenträgerdatei-Import und Validierung implementieren.',
  ),
  'billing.ik_pruefung': meta(
    1,
    9,
    'design',
    'high',
    'high',
    'medium',
    'regulated',
    'IK-/Kostenträger-Stammdaten-Prüfung gegen importierte Dateien bauen.',
  ),
  'billing.abrechnungszentren': meta(
    1,
    16,
    'discovery',
    'high',
    'high',
    'high',
    'multiple',
    'Abrechnungszentrum-Exportformate mit Pilotpartner abstimmen.',
  ),
  'accounting.datev': meta(
    1,
    21,
    'discovery',
    'high',
    'medium',
    'medium',
    'single',
    'DATEV-Export-Spezifikation und Testmandant definieren.',
  ),
  'accounting.lexware_office': meta(
    1,
    22,
    'discovery',
    'high',
    'medium',
    'medium',
    'single',
    'Lexware-Office-API-Zugang klären und Mapping entwerfen.',
  ),
  'accounting.sevdesk': meta(
    1,
    23,
    'discovery',
    'high',
    'low',
    'medium',
    'single',
    'sevDesk-REST-Schnittstelle für Belegexport evaluieren.',
  ),
  'accounting.gobd_archiv': meta(
    1,
    24,
    'design',
    'medium',
    'high',
    'high',
    'none',
    'GoBD-konformen Audit-Trail und revisionssicheres Archiv konzipieren.',
  ),
  'accounting.steuerberater_export': meta(
    3,
    320,
    'planned',
    'medium',
    'medium',
    'low',
    'none',
    'Steuerberater-Exportpakete als Marktplatz-Partnerangebot planen.',
  ),
  'payments.stripe': meta(
    1,
    31,
    'discovery',
    'high',
    'medium',
    'medium',
    'single',
    'Stripe Checkout/Connect nur in Sandbox — kein Live-Key.',
  ),
  'payments.gocardless': meta(
    1,
    32,
    'discovery',
    'high',
    'medium',
    'medium',
    'single',
    'GoCardless SEPA-Mandatsflow als Entwurf dokumentieren.',
  ),
  'payments.mollie': meta(
    1,
    33,
    'discovery',
    'medium',
    'medium',
    'medium',
    'single',
    'Mollie EU-Zahlungsflows für Pflege-Rechnungen prüfen.',
  ),
  'communication_channels.email': meta(
    1,
    51,
    'design',
    'medium',
    'medium',
    'medium',
    'single',
    'Transaktionale E-Mail mit Opt-in und Protokollierung spezifizieren.',
  ),
  'communication_channels.sms': meta(
    1,
    52,
    'design',
    'medium',
    'medium',
    'medium',
    'single',
    'SMS-Gateway für Erinnerungen — AVV und Einwilligung klären.',
  ),
  'communication_channels.push': meta(
    1,
    53,
    'design',
    'medium',
    'low',
    'medium',
    'single',
    'Push-Benachrichtigungen an Assist-App anbinden.',
  ),
  'routes_gps.maps_google': meta(
    1,
    41,
    'sandbox_ready',
    'medium',
    'low',
    'medium',
    'single',
    'Google Maps Routing-API für Touren in Sandbox testen.',
  ),
  'routes_gps.maps_here': meta(
    1,
    42,
    'sandbox_ready',
    'medium',
    'low',
    'medium',
    'single',
    'HERE Fleet-Routing als Alternative evaluieren.',
  ),
  'routes_gps.geofencing': meta(
    1,
    43,
    'design',
    'medium',
    'medium',
    'medium',
    'none',
    'Geofencing-Check-in ohne Live-GPS-Tracking validieren.',
  ),
  'documents_signatures.pdf_a': meta(
    1,
    36,
    'planned',
    'medium',
    'medium',
    'medium',
    'none',
    'PDF/A-Langzeitarchiv im Dokumentenmodul verankern.',
  ),
  'documents_signatures.archiv': meta(
    1,
    37,
    'design',
    'medium',
    'high',
    'high',
    'none',
    'Revisionssicheres Dokumentenarchiv mit Audit-Trail verbinden.',
  ),
  'documents_signatures.docusign': meta(
    1,
    38,
    'discovery',
    'medium',
    'medium',
    'high',
    'single',
    'DocuSign/eIDAS-Signatur nur nach Rechtsprüfung anbinden.',
  ),
  'medical_data.icd10_gm': meta(
    1,
    26,
    'development',
    'medium',
    'high',
    'medium',
    'regulated',
    'BfArM ICD-10-GM Import und Katalog-Aktualisierung abschließen.',
  ),
  'medical_data.medikationsdb': meta(
    2,
    110,
    'planned',
    'medium',
    'critical',
    'high',
    'regulated',
    'Arzneimitteldatenbank-Lizenz und Interaktionsprüfung klären.',
  ),
  'medical_data.snomed_ct': meta(
    2,
    112,
    'planned',
    'medium',
    'critical',
    'high',
    'regulated',
    'SNOMED-Lizenz und DE-Edition für semantische Suche klären.',
  ),
  'medical_data.loinc': meta(
    2,
    113,
    'planned',
    'low',
    'high',
    'medium',
    'regulated',
    'LOINC-Import und Mapping zu Vitalwerten spezifizieren.',
  ),
  'medical_data.ucum': meta(
    2,
    114,
    'development',
    'low',
    'low',
    'low',
    'none',
    'UCUM-Referenz in Vitalwert-Modul verankern.',
  ),
  'medical_data.bfarm_am': meta(
    2,
    115,
    'development',
    'medium',
    'high',
    'medium',
    'regulated',
    'BfArM-Arzneimittelstammdaten als öffentliche Referenz integrieren.',
  ),
  'medical_data.heilmittel': meta(
    2,
    111,
    'planned',
    'low',
    'high',
    'medium',
    'regulated',
    'Heilmittelkataloge für Verordnungsmodule vorbereiten.',
  ),
  'ti_kim.kim': meta(
    2,
    101,
    'discovery',
    'medium',
    'critical',
    'high',
    'regulated',
    'KIM-ready Postfach — TI-Zertifizierung und Konnektor-Partner abstimmen.',
  ),
  'ti_kim.ti_konnektor': meta(
    2,
    102,
    'blocked_legal',
    'medium',
    'critical',
    'high',
    'regulated',
    'TI-Gateway-Partner und SMC-B-Betrieb rechtlich absichern.',
  ),
  'ti_kim.erezept': meta(
    2,
    103,
    'blocked_legal',
    'medium',
    'critical',
    'high',
    'regulated',
    'E-Rezept nur nach TI-Freigabe — derzeit reine Vorbereitung im TI-Modul.',
  ),
  'ti_kim.epa': meta(
    2,
    104,
    'blocked_legal',
    'high',
    'critical',
    'high',
    'regulated',
    'ePA-Anbindung wartet auf TI-Gateway und Einwilligungsmodell.',
  ),
  'ti_kim.egk': meta(
    2,
    105,
    'blocked_legal',
    'low',
    'critical',
    'high',
    'regulated',
    'eGK-Lesepfad an Konnektor koppeln — nicht produktiv.',
  ),
  'ti_kim.emp': meta(
    2,
    106,
    'planned',
    'low',
    'critical',
    'high',
    'regulated',
    'eMP-Synchronisation nach eRezept/ePA priorisieren.',
  ),
  'marketplace.partner_marketplace': meta(
    3,
    309,
    'planned',
    'high',
    'medium',
    'high',
    'multiple',
    'Partner-Marktplatz mit Sanitätshaus, Apotheke und Dienstleistern modellieren.',
  ),
  'marketplace.dienstleister': meta(
    3,
    311,
    'planned',
    'high',
    'medium',
    'high',
    'multiple',
    'Sanitätshäuser, Apotheken, Fahrdienste als Partnerkategorien modellieren.',
  ),
  'marketplace.schnittstellen_partner': meta(
    3,
    312,
    'planned',
    'high',
    'medium',
    'high',
    'multiple',
    'API-/FHIR-Partner und Abrechnungszentren im Marktplatz listen.',
  ),
  'marketplace.schulungs_partner': meta(
    3,
    313,
    'planned',
    'medium',
    'low',
    'medium',
    'multiple',
    'Schulungsanbieter und Akademie-Integration verknüpfen.',
  ),
  'marketplace.software_partner': meta(
    3,
    314,
    'planned',
    'high',
    'medium',
    'high',
    'multiple',
    'Software-Erweiterungen mit Review- und Sandbox-Prozess definieren.',
  ),
};

/** Pflegefachliche Connect-Erweiterungen außerhalb des Katalogs (Phase 2). */
export const CONNECT_PLATFORM_ROADMAP: Record<string, ConnectRoadmapEntry> = {
  'pflege_care.wunddokumentation': {
    scope: 'platform',
    categoryKey: 'pflege_care',
    integrationKey: 'wunddokumentation',
    label: 'Wunddokumentation',
    summary: 'Strukturierte Wunddokumentation mit Bildern und Verlauf.',
    ...meta(
      2,
      120,
      'planned',
      'medium',
      'high',
      'high',
      'none',
      'Wundschema und Foto-Handling DSGVO-konform im Pflege-Modul planen.',
    ),
  },
  'pflege_care.bodymap': {
    scope: 'platform',
    categoryKey: 'pflege_care',
    integrationKey: 'bodymap',
    label: 'BodyMap',
    summary: 'Körperkarte für Befunde und Pflegeplanung.',
    ...meta(
      2,
      121,
      'planned',
      'low',
      'medium',
      'medium',
      'none',
      'BodyMap-UI mit Pflegedokumentation verzahnen.',
    ),
  },
  'pflege_care.pflegebericht_generator': {
    scope: 'platform',
    categoryKey: 'pflege_care',
    integrationKey: 'pflegebericht_generator',
    label: 'Pflegebericht-Generator',
    summary: 'Automatisierter Pflegebericht aus dokumentierten Daten.',
    ...meta(
      2,
      122,
      'discovery',
      'medium',
      'high',
      'high',
      'none',
      'Berichtsvorlagen und Pseudonymisierung für Exporte definieren.',
    ),
  },
  'medical_data.loinc_ucum': {
    scope: 'platform',
    categoryKey: 'medical_data',
    integrationKey: 'loinc_ucum',
    label: 'LOINC / UCUM',
    summary: 'Labor- und Maßeinheiten-Kataloge für klinische Werte.',
    ...meta(
      2,
      112,
      'planned',
      'low',
      'high',
      'medium',
      'regulated',
      'LOINC/UCUM-Import und Mapping zu Vitalwerten spezifizieren.',
    ),
  },
  'marketplace.sanitaetshaus': {
    scope: 'platform',
    categoryKey: 'marketplace',
    integrationKey: 'sanitaetshaus',
    label: 'Sanitätshäuser',
    summary: 'Partner für Hilfsmittel und Versorgung.',
    ...meta(
      3,
      315,
      'planned',
      'high',
      'medium',
      'medium',
      'multiple',
      'Sanitätshaus-Bestellungen als Marktplatz-Use-Case modellieren.',
    ),
  },
  'marketplace.apotheke': {
    scope: 'platform',
    categoryKey: 'marketplace',
    integrationKey: 'apotheke',
    label: 'Apotheken',
    summary: 'Medikamentenversorgung und Botendienste.',
    ...meta(
      3,
      316,
      'planned',
      'high',
      'high',
      'high',
      'regulated',
      'Apotheken-Anbindung nur mit eRezept/TI-Pfad — Phase 3 nach TI.',
    ),
  },
  'marketplace.pflegehilfsmittelbox': {
    scope: 'platform',
    categoryKey: 'marketplace',
    integrationKey: 'pflegehilfsmittelbox',
    label: 'Pflegehilfsmittelboxen',
    summary: 'Monatliche Hilfsmittel-Lieferungen.',
    ...meta(
      3,
      317,
      'planned',
      'high',
      'medium',
      'medium',
      'multiple',
      'Hilfsmittelbox-Partner und Abrechnungszuordnung definieren.',
    ),
  },
  'marketplace.hausnotruf': {
    scope: 'platform',
    categoryKey: 'marketplace',
    integrationKey: 'hausnotruf',
    label: 'Hausnotruf',
    summary: 'Notruf- und Telecare-Dienstleister.',
    ...meta(
      3,
      318,
      'planned',
      'medium',
      'medium',
      'medium',
      'single',
      'Hausnotruf-Alarme als optionaler Partner-Connector planen.',
    ),
  },
  'marketplace.fahrdienst': {
    scope: 'platform',
    categoryKey: 'marketplace',
    integrationKey: 'fahrdienst',
    label: 'Fahrdienste',
    summary: 'Patienten- und Einsatzfahrten extern buchen.',
    ...meta(
      3,
      319,
      'planned',
      'medium',
      'low',
      'medium',
      'multiple',
      'Fahrdienst-API an Routen-Modul koppeln.',
    ),
  },
  'marketplace.essensdienst': {
    scope: 'platform',
    categoryKey: 'marketplace',
    integrationKey: 'essensdienst',
    label: 'Essensdienste',
    summary: 'Mahlzeitenlieferung für Klient:innen.',
    ...meta(
      3,
      321,
      'planned',
      'low',
      'low',
      'low',
      'single',
      'Essensdienst-Bestellungen als Marktplatz-Pilot definieren.',
    ),
  },
  'marketplace.versicherung_beratung': {
    scope: 'platform',
    categoryKey: 'marketplace',
    integrationKey: 'versicherung_beratung',
    label: 'Versicherungen & Beratung',
    summary: 'Beratungspartner und Zusatzversicherungen.',
    ...meta(
      3,
      322,
      'planned',
      'high',
      'medium',
      'medium',
      'multiple',
      'Versicherungs-/Beratungspartner ohne Health-Data-Transfer modellieren.',
    ),
  },
};

const USER_COMING_SOON_BY_PHASE: Record<ConnectRoadmapPhase, string> = {
  1: 'In Planung — wird als nächstes für Ihren Betrieb vorbereitet. Derzeit noch keine produktive Anbindung.',
  2: 'Pflegefachliche Erweiterung in Vorbereitung — noch nicht verfügbar, ohne Live-Datenaustausch.',
  3: 'Partnerangebot geplant — Marktplatz-Funktionen folgen in einer späteren Ausbaustufe.',
};

const USER_COMING_SOON_REGULATED =
  'Regulierte Schnittstelle in Prüfung — aus rechtlichen Gründen derzeit nicht produktiv nutzbar.';

const USER_COMING_SOON_PREPARED =
  'Technische Vorbereitung abgeschlossen — Freischaltung erfolgt kontrolliert durch CareSuite+, nicht automatisch.';

/** Roadmap steuert nur Priorisierung — ändert niemals readiness oder Aktivierung. */
export function doesRoadmapEnableFeatures(): false {
  return false;
}

export function getConnectCategoryRoadmap(categoryKey: string): ConnectRoadmapMetadata | null {
  return CONNECT_CATEGORY_ROADMAP[categoryKey] ?? null;
}

export function getConnectIntegrationRoadmap(
  categoryKey: string,
  integrationKey: string,
): ConnectRoadmapMetadata | null {
  const specific = CONNECT_INTEGRATION_ROADMAP[`${categoryKey}.${integrationKey}`];
  if (specific) return specific;
  return getConnectCategoryRoadmap(categoryKey);
}

function integrationRoadmapKey(categoryKey: string, integrationKey: string): RoadmapKey {
  return `${categoryKey}.${integrationKey}`;
}

export function resolveConnectRoadmapMetadata(
  categoryKey: string,
  integrationKey?: string,
): ConnectRoadmapMetadata | null {
  if (integrationKey) {
    return getConnectIntegrationRoadmap(categoryKey, integrationKey);
  }
  return getConnectCategoryRoadmap(categoryKey);
}

export function buildConnectRoadmapEntry(
  category: ConnectCategory,
  integration?: ConnectIntegration,
): ConnectRoadmapEntry | null {
  const metadata = integration
    ? getConnectIntegrationRoadmap(category.key, integration.key)
    : getConnectCategoryRoadmap(category.key);
  if (!metadata) return null;

  return {
    scope: integration ? 'integration' : 'category',
    categoryKey: category.key,
    integrationKey: integration?.key,
    label: integration?.label ?? category.label,
    summary: integration?.description ?? category.description,
    ...metadata,
  };
}

export function getConnectAdminRoadmapEntries(): ConnectRoadmapEntry[] {
  const catalogEntries: ConnectRoadmapEntry[] = [];

  for (const category of getConnectCategories()) {
    const categoryEntry = buildConnectRoadmapEntry(category);
    if (categoryEntry) catalogEntries.push(categoryEntry);

    for (const integration of category.integrations) {
      const integrationEntry = buildConnectRoadmapEntry(category, integration);
      if (integrationEntry) catalogEntries.push(integrationEntry);
    }
  }

  const platformEntries = Object.values(CONNECT_PLATFORM_ROADMAP);
  return [...catalogEntries, ...platformEntries].sort(
    (a, b) => a.priority - b.priority || a.phase - b.phase,
  );
}

export function getConnectAdminRoadmapEntriesByPhase(
  phase: ConnectRoadmapPhase,
): ConnectRoadmapEntry[] {
  return getConnectAdminRoadmapEntries().filter((entry) => entry.phase === phase);
}

export function getConnectUserFacingComingSoonText(
  categoryKey: string,
  integration?: ConnectIntegration,
): string {
  const metadata = integration
    ? getConnectIntegrationRoadmap(categoryKey, integration.key)
    : getConnectCategoryRoadmap(categoryKey);

  if (
    metadata &&
    (metadata.release_status === 'blocked_legal' ||
      metadata.release_status === 'blocked_provider' ||
      (metadata.compliance_risk === 'critical' && metadata.provider_dependency === 'regulated'))
  ) {
    return USER_COMING_SOON_REGULATED;
  }

  if (integration?.readiness === 'prepared') {
    return USER_COMING_SOON_PREPARED;
  }

  if (!metadata) {
    return 'In Vorbereitung — derzeit keine produktive Anbindung an externe Anbieter.';
  }

  return USER_COMING_SOON_BY_PHASE[metadata.phase];
}

export function compareRoadmapPriority(
  a: ConnectRoadmapMetadata,
  b: ConnectRoadmapMetadata,
): number {
  if (a.phase !== b.phase) return a.phase - b.phase;
  return a.priority - b.priority;
}

export function getHighestPriorityPhase1Integrations(): ConnectRoadmapEntry[] {
  return getConnectAdminRoadmapEntries()
    .filter((entry) => entry.scope === 'integration' && entry.phase === 1)
    .slice(0, 15);
}

export function getCriticalComplianceRoadmapEntries(): ConnectRoadmapEntry[] {
  return getConnectAdminRoadmapEntries().filter(
    (entry) => entry.compliance_risk === 'critical' || entry.compliance_risk === 'high',
  );
}

/** Guard: Roadmap darf catalog readiness nicht verändern. */
export function assertRoadmapIsDisplayOnly(catalog: ConnectCategory[]): void {
  for (const category of catalog) {
    const categoryMeta = getConnectCategoryRoadmap(category.key);
    if (categoryMeta && categoryMeta.release_status === 'live') {
      throw new Error(`Roadmap darf Kategorie ${category.key} nicht als live markieren.`);
    }
    for (const integration of category.integrations) {
      const meta = getConnectIntegrationRoadmap(category.key, integration.key);
      if (meta?.release_status === 'live' && integration.readiness !== 'beta') {
        throw new Error(
          `Roadmap release_status live widerspricht readiness für ${category.key}.${integration.key}`,
        );
      }
    }
  }
}

export function getRoadmapEntryLabel(entry: ConnectRoadmapEntry): string {
  if (entry.scope === 'category') return `[Kategorie] ${entry.label}`;
  if (entry.scope === 'platform') return `[Plattform] ${entry.label}`;
  return entry.label;
}

export function findRoadmapEntry(
  categoryKey: string,
  integrationKey?: string,
): ConnectRoadmapEntry | null {
  const category = getConnectCategory(categoryKey);
  if (!category) {
    const platformKey = integrationKey
      ? `${categoryKey}.${integrationKey}`
      : categoryKey;
    return CONNECT_PLATFORM_ROADMAP[platformKey] ?? null;
  }

  if (integrationKey) {
    const integration = category.integrations.find((item) => item.key === integrationKey);
    if (!integration) {
      return CONNECT_PLATFORM_ROADMAP[`${categoryKey}.${integrationKey}`] ?? null;
    }
    return buildConnectRoadmapEntry(category, integration);
  }

  return buildConnectRoadmapEntry(category);
}

export function getAllRoadmapIntegrationKeys(): string[] {
  const keys: string[] = [];
  for (const category of getConnectCategories()) {
    for (const integration of category.integrations) {
      keys.push(integrationRoadmapKey(category.key, integration.key));
    }
  }
  return keys;
}
