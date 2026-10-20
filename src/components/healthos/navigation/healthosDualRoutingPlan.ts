/**
 * Dual-routing inventory and target plan (H2 — documentation only, no redirects).
 * Source: H0 healthos-ui-structure-map.md
 */

export type HealthOSDualRouteEntry = {
  canonicalKey: string;
  primaryRoute: string;
  alternateRoute: string;
  area: 'office' | 'business_office';
  purpose: string;
  risk: 'low' | 'medium' | 'high';
  h2Action: 'document' | 'wrapper_prepare' | 'deprecate_later';
  notes: string;
};

export const HEALTHOS_DUAL_ROUTES: HealthOSDualRouteEntry[] = [
  {
    canonicalKey: 'office-dashboard',
    primaryRoute: '/office',
    alternateRoute: '/business/office',
    area: 'office',
    purpose: 'Office KPI / Command Center',
    risk: 'medium',
    h2Action: 'document',
    notes: 'Gleiche Funktion, unterschiedliche Layout-Pfade. Ziel: /office als canonical.',
  },
  {
    canonicalKey: 'office-clients',
    primaryRoute: '/office/clients',
    alternateRoute: '/business/office/clients',
    area: 'office',
    purpose: 'Klient:innenliste & Akte',
    risk: 'high',
    h2Action: 'document',
    notes: 'Akte-Deep-Links oft unter /business/office/clients/[id]. Keine harte Umschaltung in H2.',
  },
  {
    canonicalKey: 'office-time-tracking',
    primaryRoute: '/business/office/time-tracking',
    alternateRoute: '/office/time-tracking',
    area: 'business_office',
    purpose: 'WFM / Arbeitszeit Team',
    risk: 'high',
    h2Action: 'document',
    notes: 'P0 WFM — nur in officeNav unter /business/office verlinkt.',
  },
  {
    canonicalKey: 'office-qm',
    primaryRoute: '/business/office/qm',
    alternateRoute: '/office/qm',
    area: 'business_office',
    purpose: 'Qualitätsmanagement / Blocker',
    risk: 'medium',
    h2Action: 'document',
    notes: 'QM nur unter business/office in Nav.',
  },
  {
    canonicalKey: 'office-access',
    primaryRoute: '/business/office/access',
    alternateRoute: '/office/access',
    area: 'business_office',
    purpose: 'Benutzer & Portale',
    risk: 'medium',
    h2Action: 'wrapper_prepare',
    notes: 'Modal-Route openInModal — HealthOS kann später Wrapper vorbereiten.',
  },
  {
    canonicalKey: 'office-settings',
    primaryRoute: '/business/office/modules',
    alternateRoute: '/business/office/settings',
    area: 'business_office',
    purpose: 'Modulzuordnungen & Mandant',
    risk: 'low',
    h2Action: 'document',
    notes: 'Settings verstreut — H3 Settings Hub.',
  },
];

export const HEALTHOS_TARGET_ROUTING_PLAN = {
  canonicalPrefix: '/office',
  businessOfficePrefix: '/business/office',
  deprecationStrategy:
    'Soft-redirects erst nach H3 Office Command Center und expliziter Freigabe. Keine Route-Entfernung in H2.',
  proposedPhases: [
    { phase: 'H2', action: 'Dokumentieren + HealthOS-Nav referenziert bestehende Routen' },
    { phase: 'H3', action: 'Office Command Center unter /office konsolidieren' },
    { phase: 'H7', action: '301/Alias-Redirects für verbleibende /business/office Deep-Links' },
  ],
  risks: [
    'Bookmarks und externe Links auf /business/office/*',
    'Modal-Routen (access, settings) brechen bei hartem Redirect',
    'WFM/time-tracking P0 — jede Redirect-Änderung regressionstestpflichtig',
  ],
} as const;
