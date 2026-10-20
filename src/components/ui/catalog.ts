export type ComponentCategory =
  | 'layout'
  | 'input'
  | 'feedback'
  | 'data-display'
  | 'navigation';

export type ComponentCatalogEntry = {
  id: string;
  name: string;
  file: string;
  category: ComponentCategory;
  description: string;
  workPackage: string;
  status: 'stable' | 'beta' | 'planned';
};

/**
 * Zentrale Metadaten-Registry für die CareSuite+ UI-Komponentenbibliothek (WP 041–060).
 */
export const COMPONENT_CATALOG: ComponentCatalogEntry[] = [
  {
    id: 'premium-card',
    name: 'PremiumCard',
    file: 'PremiumCard.tsx',
    category: 'layout',
    description: 'Gradient-Karte mit optionalem Akzent-Rand, Sheen und Press-Animation.',
    workPackage: 'WP 027',
    status: 'stable',
  },
  {
    id: 'premium-button',
    name: 'PremiumButton',
    file: 'PremiumButton.tsx',
    category: 'input',
    description: 'Primäre, sekundäre und Ghost-Aktionen mit Ladezustand.',
    workPackage: 'WP 001',
    status: 'stable',
  },
  {
    id: 'premium-badge',
    name: 'PremiumBadge',
    file: 'PremiumBadge.tsx',
    category: 'data-display',
    description: 'Status-Chip mit Farbvarianten und optionalem Punkt.',
    workPackage: 'WP 001',
    status: 'stable',
  },
  {
    id: 'premium-input',
    name: 'PremiumInput',
    file: 'PremiumInput.tsx',
    category: 'input',
    description: 'Formularfeld mit Label, Hinweis und Fehlerzustand.',
    workPackage: 'WP 004',
    status: 'stable',
  },
  {
    id: 'filter-chip',
    name: 'FilterChip',
    file: 'FilterChip.tsx',
    category: 'input',
    description: 'Auswählbare Filter-Chips für Listen und Tabellen.',
    workPackage: 'WP 004',
    status: 'stable',
  },
  {
    id: 'section-panel',
    name: 'SectionPanel',
    file: 'SectionPanel.tsx',
    category: 'layout',
    description: 'Gruppierter Inhaltsbereich mit Titel und Untertitel.',
    workPackage: 'WP 003',
    status: 'stable',
  },
  {
    id: 'module-tile',
    name: 'ModuleTile',
    file: 'ModuleTile.tsx',
    category: 'navigation',
    description: 'Modul-Kachel für Dashboards und Übersichten.',
    workPackage: 'WP 003',
    status: 'stable',
  },
  {
    id: 'state-views',
    name: 'StateViews',
    file: 'StateViews.tsx',
    category: 'feedback',
    description: 'Loading, Empty, Error und Success Zustände.',
    workPackage: 'WP 001',
    status: 'stable',
  },
  {
    id: 'premium-kpi-card',
    name: 'PremiumKpiCard',
    file: 'PremiumKpiCard.tsx',
    category: 'data-display',
    description: 'KPI-Karte mit Trend und Akzentfarbe.',
    workPackage: 'WP 003',
    status: 'stable',
  },
  {
    id: 'timeline',
    name: 'Timeline',
    file: 'Timeline.tsx',
    category: 'data-display',
    description: 'Vertikale Aktivitäts-Timeline für Detailansichten.',
    workPackage: 'WP 005',
    status: 'stable',
  },
  {
    id: 'premium-avatar',
    name: 'PremiumAvatar',
    file: 'PremiumAvatar.tsx',
    category: 'data-display',
    description: 'Initialen- oder Bild-Avatar mit Akzent-Ring und Online-Indikator.',
    workPackage: 'WP 041–060',
    status: 'stable',
  },
  {
    id: 'premium-divider',
    name: 'PremiumDivider',
    file: 'PremiumDivider.tsx',
    category: 'layout',
    description: 'Horizontale oder vertikale Trennlinie mit optionalem Label.',
    workPackage: 'WP 041–060',
    status: 'stable',
  },
  {
    id: 'premium-list-row',
    name: 'PremiumListRow',
    file: 'PremiumListRow.tsx',
    category: 'data-display',
    description: 'Listenzeile mit Leading/Trailing-Slots, Chevron und Divider.',
    workPackage: 'WP 041–060',
    status: 'stable',
  },
  {
    id: 'info-banner',
    name: 'InfoBanner',
    file: 'InfoBanner.tsx',
    category: 'feedback',
    description: 'Hinweis-Banner für Info, Erfolg, Warnung und Fehler.',
    workPackage: 'WP 041–060',
    status: 'stable',
  },
];

export function getComponentsByCategory(
  category: ComponentCategory,
): ComponentCatalogEntry[] {
  return COMPONENT_CATALOG.filter((entry) => entry.category === category);
}
