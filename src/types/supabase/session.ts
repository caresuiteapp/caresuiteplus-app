import type { AuthSession, AuthUser, Profile } from '@/types/core/auth';

export type TenantSummary = {
  id: string;
  name: string;
};

/** Supabase-Session inkl. Mandanten- und Profilkontext */
export type TenantSession = AuthSession & {
  profile: Profile;
  tenant: TenantSummary | null;
};

export type AuthBootstrapResult =
  | {
      ok: true;
      user: AuthUser;
      profile: Profile;
      session: AuthSession;
      tenant: TenantSummary | null;
    }
  | {
      ok: false;
      error: string;
    };
