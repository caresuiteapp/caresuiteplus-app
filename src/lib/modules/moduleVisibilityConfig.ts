import type { ModuleScopeKey, ModuleVisibilityCatalogEntry, ModuleVisibilityStatus } from '@/types/modules/visibility';
import { ALL_PRODUCT_KEYS } from './constants';

/**
 * Plattform-Katalog — ehrliche Defaults aus der Demo/Mock-Inventur.
 * Mandanten-Freischaltung (TenantProduct.isActive) bleibt separat in moduleAccessService.
 */
export const MODULE_VISIBILITY_CATALOG: Record<ModuleScopeKey, ModuleVisibilityCatalogEntry> = {
  office: {
    scopeKey: 'office',
    status: 'live',
    label: 'CareSuite+ Office',
    hint: 'Basisverwaltung mit Live-Anbindung für Kernfunktionen.',
  },
  assist: {
    scopeKey: 'assist',
    status: 'beta',
    label: 'Assist',
    hint: 'Einsätze und Fahrten — teilweise live, Kernpfade in Beta.',
  },
  pflege: {
    scopeKey: 'pflege',
    status: 'beta',
    label: 'Pflege',
    hint: 'Pflegedokumentation demo-funktional — Beta-Pilot.',
  },
  stationaer: {
    scopeKey: 'stationaer',
    status: 'beta',
    label: 'Stationär',
    hint: 'Bewohner:innen, Wohnbereiche und Übergaben — Beta-Pilot mit Demo-Daten.',
  },
  beratung: {
    scopeKey: 'beratung',
    status: 'beta',
    label: 'Beratung',
    hint: 'Beratungsfälle, Protokolle und Nachverfolgung — Beta-Pilot.',
  },
  akademie: {
    scopeKey: 'akademie',
    status: 'beta',
    label: 'Akademie',
    hint: 'Kurse, Zertifikate und Schulungsplan — Beta-Pilot.',
  },
  communication: {
    scopeKey: 'communication',
    status: 'beta',
    label: 'Kommunikationszentrum',
    hint: 'Nachrichten — Beta, Persistenz teilweise Demo.',
  },
  templates: {
    scopeKey: 'templates',
    status: 'beta',
    label: 'Vorlagenzentrum',
    hint: 'Vorlagenkatalog — Beta.',
  },
  modules_hub: {
    scopeKey: 'modules_hub',
    status: 'live',
    label: 'Module verwalten',
    hint: 'Modulstatus und Freischaltung.',
  },
  subscription: {
    scopeKey: 'subscription',
    status: 'live',
    label: 'Plattform & Abo',
    hint: 'Free-Platform-Übersicht.',
  },
  reporting: {
    scopeKey: 'reporting',
    status: 'internal',
    label: 'PDL-Reporting',
    hint: 'Interne Auswertungen — Demo-KPIs.',
  },
  ops: {
    scopeKey: 'ops',
    status: 'internal',
    label: 'Betrieb',
    hint: 'Ops-Hub — interner Scaffold.',
  },
  qa: {
    scopeKey: 'qa',
    status: 'internal',
    label: 'QA',
    hint: 'Qualitätssicherung — intern.',
  },
  security: {
    scopeKey: 'security',
    status: 'internal',
    label: 'Security',
    hint: 'Security-Hub — intern.',
  },
  release: {
    scopeKey: 'release',
    status: 'internal',
    label: 'Release',
    hint: 'Release-Pipelines — intern.',
  },
  roadmap: {
    scopeKey: 'roadmap',
    status: 'internal',
    label: 'Roadmap',
    hint: 'Planungs-Roadmap — intern.',
  },
  insight: {
    scopeKey: 'insight',
    status: 'internal',
    label: 'InsightCenter',
    hint: 'Analytics-Scaffold — intern.',
  },
  qm: {
    scopeKey: 'qm',
    status: 'beta',
    label: 'Qualitätsmanagement',
    hint: 'QM-Handbuch — Beta nach Migration.',
  },
  ti: {
    scopeKey: 'ti',
    status: 'disabled',
    label: 'Telematik (TI/KIM)',
    hint: 'Nur Mock-Adapter — ausgeblendet.',
  },
  platform: {
    scopeKey: 'platform',
    status: 'disabled',
    label: 'Plattform KI & OCR',
    hint: 'Kein echter Provider — ausgeblendet.',
  },
  integrations: {
    scopeKey: 'integrations',
    status: 'disabled',
    label: 'Integrationen',
    hint: 'Demo-Provider — ausgeblendet.',
  },
  connect: {
    scopeKey: 'connect',
    status: 'beta',
    label: 'CareSuite+ Connect',
    hint: 'Integrationskatalog — Schnittstellen vorbereitet, Live-Connect in Beta.',
  },
  admin: {
    scopeKey: 'admin',
    status: 'internal',
    label: 'Admin & Entwickler',
    hint: 'Technische Verwaltung — nur Admin/Developer.',
  },
};

export const MODULE_VISIBILITY_STATUS_LABELS: Record<ModuleVisibilityStatus, string> = {
  live: 'Live',
  beta: 'Beta',
  internal: 'Intern',
  coming_soon: 'In Vorbereitung',
  disabled: 'Deaktiviert',
};

export const PRODUCT_SCOPE_KEYS = ALL_PRODUCT_KEYS;

export function getCatalogEntry(scopeKey: ModuleScopeKey): ModuleVisibilityCatalogEntry {
  return MODULE_VISIBILITY_CATALOG[scopeKey];
}

export function isProductScopeKey(scopeKey: ModuleScopeKey): scopeKey is (typeof ALL_PRODUCT_KEYS)[number] {
  return (ALL_PRODUCT_KEYS as readonly string[]).includes(scopeKey);
}
