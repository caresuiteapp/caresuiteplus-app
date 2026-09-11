/** Public links for the web application; mobile configuration is maintained separately. */
export const SUPPORT_LINKS = {
  help: 'https://www.caresuiteplus.app/impressum',
  privacy: 'https://www.caresuiteplus.app/datenschutz',
  imprint: 'https://www.caresuiteplus.app/impressum',
  terms: 'https://www.caresuiteplus.app/nutzungsbedingungen',
  supportEmail: 'caresuiteapp@gmail.com',
} as const;

export type SupportLinkKey = keyof typeof SUPPORT_LINKS;
