import { resolveTimeBasedGermanGreeting } from '@/lib/portal/engine/portalHeroCopy';

/** Time-of-day greeting for Klient:innenportal hero — never tenant-as-name. */
export function resolveClientPortalGreetingLine(date = new Date()): string {
  return resolveTimeBasedGermanGreeting(date);
}

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
    greetingLine: resolveClientPortalGreetingLine(),
    nameLine,
    providerLine,
  };
}
