export type ConnectReadiness = 'prepared' | 'coming_soon' | 'disabled' | 'beta' | 'internal';

/** Strategische Connect-Roadmap — steuert Entwicklung, aktiviert keine Features. */
export type ConnectRoadmapPhase = 1 | 2 | 3;

export type ConnectReleaseStatus =
  | 'planned'
  | 'discovery'
  | 'design'
  | 'development'
  | 'sandbox_ready'
  | 'blocked_provider'
  | 'blocked_legal'
  | 'beta'
  | 'live'
  | 'paused';

export type ConnectRevenueRelevance = 'low' | 'medium' | 'high';
export type ConnectComplianceRisk = 'low' | 'medium' | 'high' | 'critical';
export type ConnectImplementationComplexity = 'low' | 'medium' | 'high';
export type ConnectProviderDependency = 'none' | 'single' | 'multiple' | 'regulated';

export type ConnectRoadmapMetadata = {
  phase: ConnectRoadmapPhase;
  /** Niedrigere Zahl = höhere Priorität innerhalb der Plattform-Roadmap. */
  priority: number;
  release_status: ConnectReleaseStatus;
  revenue_relevance: ConnectRevenueRelevance;
  compliance_risk: ConnectComplianceRisk;
  implementation_complexity: ConnectImplementationComplexity;
  provider_dependency: ConnectProviderDependency;
  /** Nächster Entwicklungsschritt — nur für Admin-Roadmap sichtbar. */
  next_step: string;
};

export type ConnectRoadmapScope = 'category' | 'integration' | 'platform';

export type ConnectRoadmapEntry = ConnectRoadmapMetadata & {
  scope: ConnectRoadmapScope;
  categoryKey: string;
  integrationKey?: string;
  label: string;
  /** Kurzbeschreibung für Admin-Übersicht. */
  summary: string;
};

export type ConnectIntegration = {
  key: string;
  label: string;
  description: string;
  readiness: ConnectReadiness;
  requiresProvider: boolean;
  auditPrepared: true;
  /** Optional deep link into an existing CareSuite+ module (e.g. TI). */
  moduleHref?: string;
};

export type ConnectCategory = {
  key: string;
  label: string;
  description: string;
  icon: string;
  readiness: ConnectReadiness;
  integrations: ConnectIntegration[];
};

export type ConnectProviderPlaceholder = {
  id: string;
  tenantId: string;
  integrationKey: string;
  label: string;
  status: 'not_configured' | 'placeholder';
  vaultReference: string | null;
  updatedAt: string;
};

export const CONNECT_READINESS_LABELS: Record<ConnectReadiness, string> = {
  prepared: 'Vorbereitet',
  coming_soon: 'In Vorbereitung',
  disabled: 'Deaktiviert',
  beta: 'Beta',
  internal: 'Intern',
};

export const CONNECT_CATEGORY_STATUS_LABELS: Record<ConnectReadiness, string> = {
  prepared: 'Schnittstelle vorbereitet',
  coming_soon: 'In Vorbereitung',
  disabled: 'Nicht verfügbar',
  beta: 'Beta',
  internal: 'Intern',
};

export const CONNECT_ROADMAP_PHASE_LABELS: Record<ConnectRoadmapPhase, string> = {
  1: 'Phase 1 — Sofort wichtig',
  2: 'Phase 2 — Pflegefachlich',
  3: 'Phase 3 — Marktplatz & Partner',
};

export const CONNECT_RELEASE_STATUS_LABELS: Record<ConnectReleaseStatus, string> = {
  planned: 'Geplant',
  discovery: 'Discovery',
  design: 'Design',
  development: 'Entwicklung',
  sandbox_ready: 'Sandbox bereit',
  blocked_provider: 'Blockiert (Anbieter)',
  blocked_legal: 'Blockiert (Recht)',
  beta: 'Beta',
  live: 'Live',
  paused: 'Pausiert',
};

export const CONNECT_COMPLIANCE_RISK_LABELS: Record<ConnectComplianceRisk, string> = {
  low: 'Gering',
  medium: 'Mittel',
  high: 'Hoch',
  critical: 'Kritisch',
};
