/** Status values eligible for client portal Dokumente (excludes drafts/archived/locked). */
export const PORTAL_CLIENT_DOCUMENT_STATUSES = ['aktiv', 'abgeschlossen', 'bestaetigt'] as const;

/** Sensitivity levels that must never appear in the client portal. */
export const PORTAL_INTERNAL_SENSITIVITIES = ['internal', 'restricted'] as const;

/** Leistungsnachweise belong on the Nachweise tab, not Dokumente. */
export const PORTAL_PROOFS_CATEGORY = 'leistungsnachweis';

export function isPortalInternalDocument(sensitivity: string): boolean {
  return (PORTAL_INTERNAL_SENSITIVITIES as readonly string[]).includes(sensitivity);
}
