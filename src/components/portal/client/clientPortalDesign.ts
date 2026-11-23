import type { LiquidPortalNavigationItem } from '@/liquid-command/navigation/portalCatalog';
export { clientPortalNight as clientPortalDesign } from '@/design/tokens/clientPortalNight';

/** Reuse the original artwork of the same function, never a fabricated fallback. */
export const clientPortalArtwork: Readonly<Record<string, string>> = {
  home: '/portal/employee', appointments: '/assist/assignments', live: '/assist/live-status',
  documents: '/business/office/documents', signatures: '/business/office/documents/signatures',
  proofs: '/assist/nachweise', messages: '/business/messages?audience=clients',
  announcements: '/business/messages?audience=employees&view=broadcasts',
  budget: '/assist/abrechnungsquellen', academy: '/akademie', help: '/support', profile: '/settings/profile',
};
export const clientRailLabels: Readonly<Record<string, string>> = {
  home: 'Übersicht', appointments: 'Einsätze', live: 'Anfahrt', documents: 'Dokumente',
  signatures: 'Signieren', proofs: 'Nachweise', messages: 'Postfach', announcements: 'Infos',
  budget: 'Budget', academy: 'Akademie', help: 'Hilfe', profile: 'Profil',
};

export function clientPortalActiveId(pathname: string, navigation: readonly LiquidPortalNavigationItem[]) {
  const path = pathname.replace(/\/+$/, '');
  return [...navigation].sort((a, b) => b.route.length - a.route.length)
    .find(item => path === item.route || path.startsWith(`${item.route}/`))?.id ?? 'home';
}

export function clientPortalLayout(width: number, fontScale = 1) {
  const scale = Math.max(1, fontScale);
  const phone = width < 640;
  const readableWidth = width / scale;
  const railWidth = Math.max(96, Math.min(132, Math.ceil(96 * scale)));
  const contentWidth = Math.max(0, width - (phone ? 0 : railWidth));
  return { phone, railWidth, contentWidth, singleHeaderRow: readableWidth >= 1440,
    stackedWeather: phone && readableWidth < 290,
    contentColumns: contentWidth / scale >= 1000 ? 3 : contentWidth / scale >= 680 ? 2 : 1 };
}
