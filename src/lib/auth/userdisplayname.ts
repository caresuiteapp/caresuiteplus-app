import type { AuthUser, Profile } from '@/types';
import { isPortalUsernameLabel } from '@/lib/portal/clientPortalDisplayName';
import type { PortalSessionRecord } from './portalSessionStore';

/** Supabase portal auth uses synthetic local emails — never show in UI. */
export function isSyntheticPortalEmail(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return trimmed.endsWith('@caresuite-portal.local');
}

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

  const displayName = resolveNonUsernameLabel(profile?.displayName ?? user?.displayName);
  if (displayName) return displayName;

  const email = profile?.email?.trim() || user?.email?.trim();
  if (email && !isSyntheticPortalEmail(email)) return email;

  return fallback;
}

function isClientPortalSession(
  portalSession: PortalSessionRecord | null | undefined,
): boolean {
  return portalSession?.loginType === 'client_portal' || portalSession?.roleKey === 'client_portal';
}

function isEmployeePortalSession(
  portalSession: PortalSessionRecord | null | undefined,
): boolean {
  return portalSession?.loginType === 'employee_portal' || portalSession?.roleKey === 'employee_portal';
}

function resolveNonUsernameLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || isPortalUsernameLabel(trimmed)) return null;
  return trimmed;
}

/** Portal welcome line — real client name, never portal username when avoidable. */
export function getPortalDisplayName(
  profile: Profile | null | undefined,
  user: AuthUser | null | undefined,
  portalSession: PortalSessionRecord | null | undefined,
  fallback = 'Portal',
): string {
  const portalLabel = resolveNonUsernameLabel(portalSession?.displayName);
  if (portalLabel) return portalLabel;

  if (isClientPortalSession(portalSession) || isEmployeePortalSession(portalSession)) {
    const composed = composeUserFullName(profile?.firstName, profile?.lastName);
    if (composed && !isPortalUsernameLabel(composed)) return composed;

    const profileLabel = resolveNonUsernameLabel(profile?.displayName);
    if (profileLabel) return profileLabel;

    const userLabel = resolveNonUsernameLabel(user?.displayName);
    if (userLabel) return userLabel;

    return fallback;
  }

  return getUserDisplayName(profile, user, fallback);
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
