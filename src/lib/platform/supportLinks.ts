/**
 * Legal and support URLs for store compliance and in-app settings.
 * Replace placeholders before production store submission.
 */
export const SUPPORT_LINKS = {
  help: 'https://caresuiteplus.de/hilfe',
  privacy: 'https://caresuiteplus.de/datenschutz',
  imprint: 'https://caresuiteplus.de/impressum',
  terms: 'https://caresuiteplus.de/nutzungsbedingungen',
  supportEmail: 'support@caresuiteplus.de',
} as const;

export type SupportLinkKey = keyof typeof SUPPORT_LINKS;
