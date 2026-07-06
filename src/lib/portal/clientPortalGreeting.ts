/** Canonical Klient:innenportal greeting — always "Hallo", never tenant-as-name. */
export const CLIENT_PORTAL_GREETING = 'Hallo';

export type ClientPortalHeroLines = {
  greetingLine: string;
  nameLine: string;
  providerLine: string;
};

export function resolveClientPortalHeroLines(input: {
  displayName?: string | null;
  tenantName?: string | null;
  moduleLabel?: string | null;
}): ClientPortalHeroLines {
  const displayName = input.displayName?.trim();
  const tenantName = input.tenantName?.trim();
  const moduleLabel = input.moduleLabel?.trim() || 'Assist';

  const nameLine =
    displayName &&
    displayName !== tenantName &&
    !/^klient:?in$/i.test(displayName) &&
    displayName !== 'Willkommen'
      ? displayName
      : 'Klient:in';

  const providerLine = tenantName ? `${tenantName} · ${moduleLabel}` : moduleLabel;

  return {
    greetingLine: CLIENT_PORTAL_GREETING,
    nameLine,
    providerLine,
  };
}
