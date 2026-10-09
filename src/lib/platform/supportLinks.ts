/**
 * Legal and support URLs for store compliance and in-app settings.
 * Replace placeholders before production store submission.
 */
export const SUPPORT_LINKS = {
  help: 'https://www.caresuiteplus.app/support',
  privacy: 'https://www.caresuiteplus.app/datenschutz',
  imprint: 'https://www.caresuiteplus.app/impressum',
  terms: 'https://www.caresuiteplus.app/nutzungsbedingungen',
  supportEmail: 'caresuiteapp@gmail.com',
} as const;

export type SupportLinkKey = keyof typeof SUPPORT_LINKS;
