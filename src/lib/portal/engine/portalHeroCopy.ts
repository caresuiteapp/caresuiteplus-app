import type { PortalTerminology } from '@/lib/portal/types';

/** Time-of-day greeting for compact mobile portal hero. */
export function resolveTimeBasedGermanGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 11) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

type PortalHeroCopyInput = {
  displayName: string;
  tenantName: string;
  terminology: PortalTerminology;
  isPhone: boolean;
  roleLabel?: string;
  releaseLabel?: string;
};

export type PortalHeroCopy = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
};

/** Resolves hero copy — short greeting on phone, full welcome on larger screens. */
export function resolvePortalHeroCopy({
  displayName,
  tenantName,
  terminology,
  isPhone,
  roleLabel = 'Klient:in',
  releaseLabel = 'Freigabe aktiv',
}: PortalHeroCopyInput): PortalHeroCopy {
  const moduleEyebrow = `${terminology.moduleLabel}-Portal`.toUpperCase();

  if (isPhone) {
    return {
      eyebrow: moduleEyebrow,
      title: `${resolveTimeBasedGermanGreeting()}, ${displayName}`,
      meta: `${tenantName} · ${terminology.moduleLabel} · ${roleLabel} · ${releaseLabel}`,
      badge: terminology.moduleLabel,
    };
  }

  return {
    eyebrow: moduleEyebrow,
    title: `${terminology.greetingLabel}, ${displayName}`,
    subtitle: tenantName,
    meta: `${terminology.moduleLabel} · Rolle: ${roleLabel} · ${releaseLabel}`,
    badge: terminology.moduleLabel,
  };
}
