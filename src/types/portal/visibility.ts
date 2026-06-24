export type DataVisibilityScope = 'own' | 'shared' | 'team' | 'tenant_admin' | 'internal';

export type SensitivityLevel =
  | 'public'
  | 'standard'
  | 'internal'
  | 'care'
  | 'health'
  | 'restricted';

export const SENSITIVITY_LABELS: Record<SensitivityLevel, string> = {
  public: 'Öffentlich',
  standard: 'Standard',
  internal: 'Intern',
  care: 'Pflegerelevant',
  health: 'Gesundheitsdaten',
  restricted: 'Hochsensibel',
};

export const VISIBILITY_LABELS: Record<DataVisibilityScope, string> = {
  own: 'Eigene Daten',
  shared: 'Freigegeben',
  team: 'Team',
  tenant_admin: 'Mandantenverwaltung',
  internal: 'Intern',
};

export type PortalScopedEntity = {
  visibility: DataVisibilityScope;
  sensitivity: SensitivityLevel;
  ownedByProfileId?: string | null;
  sharedWithProfileIds?: string[];
};
