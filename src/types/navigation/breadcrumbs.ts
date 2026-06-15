export type BreadcrumbItem = {
  /** Vollständiger Pfad bis zu diesem Segment */
  path: string;
  /** Anzeigename aus APP_ROUTES oder Fallback */
  label: string;
  /** Letztes Element der Kette — nicht navigierbar */
  isCurrent?: boolean;
};

export type BreadcrumbTrail = BreadcrumbItem[];
