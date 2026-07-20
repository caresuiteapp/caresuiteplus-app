/**
 * Office-Formularstandard:
 * Fachliche Werte und Verknüpfungen werden aus kontrollierten Systemwerten gewählt.
 * Persistenter Freitext ist ausschließlich für inhaltliche Texte vorgesehen.
 */
export const STRUCTURED_FIELD_CATEGORIES = [
  'person',
  'organization',
  'status',
  'catalog',
  'service',
  'period',
  'date',
  'assignment',
] as const;

export const ALLOWED_PERSISTENT_FREE_TEXT_PURPOSES = [
  'note',
  'description',
  'reason',
  'message',
  'addressSupplement',
] as const;

export function isAllowedPersistentFreeTextPurpose(value: string): boolean {
  return (ALLOWED_PERSISTENT_FREE_TEXT_PURPOSES as readonly string[]).includes(value);
}
