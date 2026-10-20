import type { Profile, ServiceResult } from '@/types';
import { composeUserFullName } from '@/lib/auth/userdisplayname';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/supabase/config';
import { toGermanSupabaseError } from '@/lib/supabase/errors';

export type UserProfileForm = {
  firstName: string;
  lastName: string;
};

/** Live DB: full_name is GENERATED from first_name + last_name — must not be sent on UPDATE. */
export function buildUserProfileWritePayload(
  firstName: string,
  lastName: string,
  updatedAt: string,
): { first_name: string | null; last_name: string | null; updated_at: string } {
  return {
    first_name: firstName || null,
    last_name: lastName || null,
    updated_at: updatedAt,
  };
}

const demoOverrides = new Map<string, Partial<Profile>>();

export function applyDemoProfileOverride(profile: Profile): Profile {
  const override = demoOverrides.get(profile.id);
  if (!override) return profile;
  return { ...profile, ...override };
}

export function patchDemoProfileOverride(
  profileId: string,
  patch: Partial<Profile>,
): void {
  demoOverrides.set(profileId, { ...demoOverrides.get(profileId), ...patch });
}

export async function saveUserProfile(
  profile: Profile,
  form: UserProfileForm,
): Promise<ServiceResult<Profile>> {
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const displayName = composeUserFullName(firstName, lastName);

  if (!firstName && !lastName && !profile.displayName?.trim()) {
    return { ok: false, error: 'Bitte geben Sie mindestens Vor- oder Nachname an.' };
  }

  const updatedAt = new Date().toISOString();
  const patch: Partial<Profile> = {
    firstName: firstName || null,
    lastName: lastName || null,
    displayName: displayName ?? profile.displayName,
    updatedAt,
  };

  if (isDemoMode()) {
    demoOverrides.set(profile.id, { ...demoOverrides.get(profile.id), ...patch });
    return { ok: true, data: { ...profile, ...patch } };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
  }

  const { data, error } = await client
    .from('profiles')
    .update(buildUserProfileWritePayload(firstName, lastName, updatedAt))
    .eq('id', profile.id)
    .select('id, tenant_id, role_id, first_name, last_name, full_name, email, phone, avatar_url, created_at, updated_at')
    .maybeSingle();

  if (error) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }
  if (!data) {
    return { ok: false, error: 'Profil konnte nicht gespeichert werden.' };
  }

  return {
    ok: true,
    data: {
      ...profile,
      firstName: data.first_name?.trim() || null,
      lastName: data.last_name?.trim() || null,
      displayName: composeUserFullName(data.first_name, data.last_name) ?? data.full_name?.trim() ?? profile.displayName,
      updatedAt: data.updated_at,
    },
  };
}
