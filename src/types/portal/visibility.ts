export type DataVisibilityScope = 'own' | 'shared' | 'team' | 'tenant_admin';

export type SensitivityLevel =
  | 'public'
  | 'internal'
  | 'care'
  | 'health'
  | 'restricted';

export const SENSITIVITY_LABELS: Record<SensitivityLevel, string> = {
  public: 'Öffentlich',
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
};

export type PortalScopedEntity = {
  visibility: DataVisibilityScope;
  sensitivity: SensitivityLevel;
  ownedByProfileId?: string;
  sharedWithProfileIds?: string[];
};
