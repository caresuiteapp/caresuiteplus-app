import type { AuthUser, Profile } from '@/types';

export function composeUserFullName(
  firstName?: string | null,
  lastName?: string | null,
): string | null {
  const composed = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ');
  return composed || null;
}

/** Prefer Vorname + Nachname; fall back to display name, then email. */
export function getUserDisplayName(
  profile: Profile | null | undefined,
  user?: AuthUser | null,
  fallback = 'CareSuite+',
): string {
  const composed = composeUserFullName(profile?.firstName, profile?.lastName);
  if (composed) return composed;

  const displayName = profile?.displayName?.trim() || user?.displayName?.trim();
  if (displayName) return displayName;

  const email = profile?.email?.trim() || user?.email?.trim();
  if (email) return email;

  return fallback;
}

/** First letter of first name, otherwise first letter of resolved display name. */
export function getUserDisplayNameInitial(
  profile: Profile | null | undefined,
  user?: AuthUser | null,
  fallback = 'C',
): string {
  const firstInitial = profile?.firstName?.trim()?.[0];
  if (firstInitial) return firstInitial.toUpperCase();

  const displayName = getUserDisplayName(profile, user, '');
  const initial = displayName.trim()[0];
  return initial ? initial.toUpperCase() : fallback;
}
