import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { AuthSession, AuthUser, Profile, RoleKey } from '@/types';
import {
  getSession,
  onAuthStateChange,
  resolveAuthMode,
  signOut as supabaseSignOut,
} from '@/lib/supabase';
import { bootstrapTenantContext } from '@/lib/supabase/tenantService';
import { hydrateTenantModulesFromSupabase } from '@/lib/modules/moduleAccessHydration';
import { hydrateTenantModuleSettings } from '@/lib/tenant/tenantModuleSettingsHydration';
import { fetchRuntimePermissions } from '@/lib/supabase/permissionRepository';
import { AuthContext, type AuthContextValue } from './context';
import {
  clearPortalSession,
  loadPortalSession,
  savePortalSession,
  type PortalSessionRecord,
} from './portalSessionStore';
import { clearBusinessWelcomePending } from './businessWelcomeSession';
import { shouldClearAuthOnNullSessionEvent } from './authStateEvents';
import { clearOfflineDb } from '@/lib/offline/idb';
import { withAuthBootstrapTimeout } from './authBootstrapTimeout';

type AuthProviderProps = {
  children: ReactNode;
};

function applyBootstrap(
  result: Awaited<ReturnType<typeof bootstrapTenantContext>>,
  setUser: (user: AuthUser | null) => void,
  setProfile: (profile: Profile | null) => void,
  setSession: (session: AuthSession | null) => void,
): void {
  if (result.ok) {
    setUser(result.user);
    setProfile(result.profile);
    setSession(result.session);
    return;
  }

  setUser(null);
  setProfile(null);
  setSession(null);
}

function buildMinimalAuthState(supabaseSession: Session): {
  user: AuthUser;
  session: AuthSession;
} {
  const user: AuthUser = {
    id: supabaseSession.user.id,
    email: supabaseSession.user.email ?? '',
    displayName: null,
    roleKey: null,
  };

  const session: AuthSession = {
    user,
    accessToken: supabaseSession.access_token,
    refreshToken: supabaseSession.refresh_token,
    expiresAt: supabaseSession.expires_at ? supabaseSession.expires_at * 1000 : null,
  };

  return { user, session };
}

function applyPortalAuthFallback(
  supabaseSession: Session,
  record: PortalSessionRecord,
  setUser: (user: AuthUser | null) => void,
  setProfile: (profile: Profile | null) => void,
  setSession: (session: AuthSession | null) => void,
): void {
  const minimal = buildMinimalAuthState(supabaseSession);
  const displayName = record.displayName?.trim() || null;
  const now = new Date().toISOString();

  setUser({
    ...minimal.user,
    displayName,
    roleKey: record.roleKey,
  });
  setProfile({
    id: minimal.user.id,
    tenantId: record.tenantId,
    roleId: null,
    roleKey: record.roleKey,
    firstName: null,
    lastName: null,
    displayName,
    email: minimal.user.email || null,
    phone: null,
    avatarUrl: null,
    employeeId: record.employeeId ?? null,
    createdAt: now,
    updatedAt: now,
  });
  setSession(minimal.session);
}

function alignBootstrapWithPortalSession(
  bootstrap: Extract<Awaited<ReturnType<typeof bootstrapTenantContext>>, { ok: true }>,
  record: PortalSessionRecord,
) {
  if (bootstrap.profile.roleKey === record.roleKey) {
    return bootstrap;
  }

  return {
    ...bootstrap,
    user: { ...bootstrap.user, roleKey: record.roleKey },
    profile: {
      ...bootstrap.profile,
      roleKey: record.roleKey,
      tenantId: record.tenantId || bootstrap.profile.tenantId,
      displayName: record.displayName ?? bootstrap.profile.displayName,
    },
  };
}

type HydrateSupabaseSessionResult =
  | { ok: true }
  | { ok: false; error: string };

async function hydrateSupabaseSession(
  supabaseSession: Session,
  setUser: (user: AuthUser | null) => void,
  setProfile: (profile: Profile | null) => void,
  setSession: (session: AuthSession | null) => void,
  setProfileBootstrapError: (error: string | null) => void,
): Promise<HydrateSupabaseSessionResult> {
  try {
    const bootstrap = await withAuthBootstrapTimeout(
      bootstrapTenantContext(supabaseSession),
      'Profil-Bootstrap',
    );
    if (bootstrap.ok) {
      setProfileBootstrapError(null);
      applyBootstrap(bootstrap, setUser, setProfile, setSession);
      if (bootstrap.profile.roleKey && bootstrap.profile.tenantId) {
        void fetchRuntimePermissions(bootstrap.profile.roleKey, bootstrap.profile.tenantId);
        void hydrateTenantModulesFromSupabase(bootstrap.profile.tenantId);
        void hydrateTenantModuleSettings(bootstrap.profile.tenantId);
      }
      return { ok: true };
    }

    return { ok: false, error: bootstrap.error };
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error
          ? cause.message
          : 'Benutzerprofil konnte nicht geladen werden.',
    };
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const authMode = useMemo(() => resolveAuthMode(), []);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [portalSession, setPortalSession] = useState<PortalSessionRecord | null>(null);
  const [profileBootstrapError, setProfileBootstrapError] = useState<string | null>(null);
  const profileRepairAttemptedRef = useRef(false);
  const signOutRequestedRef = useRef(false);

  const applyMinimalAuthOnBootstrapFailure = useCallback(
    (supabaseSession: Session, error: string) => {
      const minimal = buildMinimalAuthState(supabaseSession);
      setUser(minimal.user);
      setProfile(null);
      setSession(minimal.session);
      setProfileBootstrapError(error);
      profileRepairAttemptedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let unsubscribeAuth: (() => void) | undefined;

    async function restoreSupabaseSession() {
      try {
        const sessionResult = await getSession();
        if (cancelled) return;

        if (sessionResult.ok && sessionResult.data) {
          const hydrated = await hydrateSupabaseSession(
            sessionResult.data,
            setUser,
            setProfile,
            setSession,
            setProfileBootstrapError,
          );
          if (!cancelled && !hydrated.ok) {
            applyMinimalAuthOnBootstrapFailure(sessionResult.data, hydrated.error);
          }
        }
      } catch (cause) {
        if (cancelled) return;
        const sessionResult = await getSession();
        if (!sessionResult.ok || !sessionResult.data) return;
        applyMinimalAuthOnBootstrapFailure(
          sessionResult.data,
          cause instanceof Error ? cause.message : 'Sitzung konnte nicht wiederhergestellt werden.',
        );
      }
    }

    async function init() {
      try {
        const restoredPortal = await loadPortalSession();
        if (!cancelled && restoredPortal) {
          setPortalSession(restoredPortal);
        }

        if (authMode === 'supabase') {
          void restoreSupabaseSession();

          const handle = onAuthStateChange((event: AuthChangeEvent, supabaseSession) => {
            if (cancelled) return;
            if (event === 'TOKEN_REFRESHED') return;

            void (async () => {
              try {
                if (supabaseSession) {
                  const result = await hydrateSupabaseSession(
                    supabaseSession,
                    setUser,
                    setProfile,
                    setSession,
                    setProfileBootstrapError,
                  );
                  if (!result.ok && !cancelled) {
                    applyMinimalAuthOnBootstrapFailure(supabaseSession, result.error);
                  }
                  return;
                }

                if (!shouldClearAuthOnNullSessionEvent(event, signOutRequestedRef.current)) {
                  return;
                }

                if (!cancelled) {
                  setUser(null);
                  setProfile(null);
                  setSession(null);
                  setProfileBootstrapError(null);
                }
              } catch (cause) {
                if (cancelled || !supabaseSession) return;
                applyMinimalAuthOnBootstrapFailure(
                  supabaseSession,
                  cause instanceof Error ? cause.message : 'Sitzung konnte nicht aktualisiert werden.',
                );
              }
            })();
          });
          unsubscribeAuth = handle.unsubscribe;
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      unsubscribeAuth?.();
    };
  }, [applyMinimalAuthOnBootstrapFailure, authMode]);

  useEffect(() => {
    if (!user || !session) {
      profileRepairAttemptedRef.current = false;
    }
  }, [user, session]);

  useEffect(() => {
    if (authMode !== 'supabase' || !isInitialized || isLoading) return;
    if (Boolean((user && session) || portalSession)) return;

    let cancelled = false;

    async function reconcileLiveSession() {
      const sessionResult = await getSession();
      if (cancelled || !sessionResult.ok || !sessionResult.data) return;

      const hydrated = await hydrateSupabaseSession(
        sessionResult.data,
        setUser,
        setProfile,
        setSession,
        setProfileBootstrapError,
      );
      if (cancelled) return;
      if (hydrated.ok) return;

      applyMinimalAuthOnBootstrapFailure(sessionResult.data, hydrated.error);
    }

    void reconcileLiveSession();

    return () => {
      cancelled = true;
    };
  }, [applyMinimalAuthOnBootstrapFailure, authMode, isInitialized, isLoading, portalSession, session, user]);

  useEffect(() => {
    if (authMode !== 'supabase' || !isInitialized || isLoading) return;
    if (!user || !session || profile?.roleKey || profileRepairAttemptedRef.current) return;

    profileRepairAttemptedRef.current = true;
    let cancelled = false;

    async function repairProfileFromSession() {
      const sessionResult = await getSession();
      if (cancelled || !sessionResult.ok || !sessionResult.data) return;

      const result = await hydrateSupabaseSession(
        sessionResult.data,
        setUser,
        setProfile,
        setSession,
        setProfileBootstrapError,
      );
      if (cancelled) return;
      if (result.ok) return;

      applyMinimalAuthOnBootstrapFailure(sessionResult.data, result.error);
    }

    void repairProfileFromSession();

    return () => {
      cancelled = true;
    };
  }, [
    applyMinimalAuthOnBootstrapFailure,
    authMode,
    isInitialized,
    isLoading,
    user,
    session,
    profile?.roleKey,
  ]);

  const signInWithSupabaseSession = useCallback(async (supabaseSession: Session) => {
    await clearPortalSession();
    setPortalSession(null);
    setProfileBootstrapError(null);

    const hydrated = await hydrateSupabaseSession(
      supabaseSession,
      setUser,
      setProfile,
      setSession,
      setProfileBootstrapError,
    );
    if (!hydrated.ok) {
      applyMinimalAuthOnBootstrapFailure(supabaseSession, hydrated.error);
    }
  }, [applyMinimalAuthOnBootstrapFailure]);

  const retryProfileBootstrap = useCallback(async () => {
    setProfileBootstrapError(null);
    profileRepairAttemptedRef.current = false;

    const sessionResult = await getSession();
    if (!sessionResult.ok || !sessionResult.data) {
      setProfileBootstrapError('Keine aktive Sitzung gefunden.');
      return;
    }

    const result = await hydrateSupabaseSession(
      sessionResult.data,
      setUser,
      setProfile,
      setSession,
      setProfileBootstrapError,
    );
    if (!result.ok) {
      applyMinimalAuthOnBootstrapFailure(sessionResult.data, result.error);
    }
  }, [applyMinimalAuthOnBootstrapFailure]);

  const signInPortalSession = useCallback(async (record: PortalSessionRecord) => {
    await savePortalSession(record);
    setPortalSession(record);

    const sessionResult = await getSession();
    if (!sessionResult.ok || !sessionResult.data) return;

    const bootstrap = await bootstrapTenantContext(sessionResult.data);
    if (!bootstrap.ok) {
      applyPortalAuthFallback(
        sessionResult.data,
        record,
        setUser,
        setProfile,
        setSession,
      );
      setProfileBootstrapError(null);
      void fetchRuntimePermissions(record.roleKey, record.tenantId);
      void hydrateTenantModulesFromSupabase(record.tenantId);
      void hydrateTenantModuleSettings(record.tenantId);
      return;
    }

    setProfileBootstrapError(null);
    const aligned = alignBootstrapWithPortalSession(bootstrap, record);
    applyBootstrap(aligned, setUser, setProfile, setSession);
    if (aligned.profile.roleKey && aligned.profile.tenantId) {
      void fetchRuntimePermissions(aligned.profile.roleKey, aligned.profile.tenantId);
      void hydrateTenantModulesFromSupabase(aligned.profile.tenantId);
      void hydrateTenantModuleSettings(aligned.profile.tenantId);
    }
  }, []);

  const updatePortalSession = useCallback(async (patch: Partial<PortalSessionRecord>) => {
    setPortalSession((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      void savePortalSession(next);
      return next;
    });
  }, []);

  const updateProfile = useCallback((nextProfile: Profile) => {
    setProfile(nextProfile);
    setUser((prev) =>
      prev
        ? {
            ...prev,
            displayName: nextProfile.displayName,
            roleKey: nextProfile.roleKey,
          }
        : prev,
    );
  }, []);

  const signOut = useCallback(async () => {
    signOutRequestedRef.current = true;
    setIsLoading(true);
    try {
      await supabaseSignOut();
      await clearPortalSession();
      void clearOfflineDb();
      clearBusinessWelcomePending();
      setUser(null);
      setProfile(null);
      setSession(null);
      setPortalSession(null);
      setProfileBootstrapError(null);
    } finally {
      signOutRequestedRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isInitialized,
      isLoading,
      authReady: isInitialized && !isLoading,
      isAuthenticated: Boolean((user && session) || portalSession),
      authMode,
      user,
      profile,
      session,
      portalSession,
      profileBootstrapError,
      signInWithSupabaseSession,
      signInPortalSession,
      updatePortalSession,
      retryProfileBootstrap,
      signOut,
      updateProfile,
    }),
    [
      isInitialized,
      isLoading,
      authMode,
      user,
      profile,
      session,
      portalSession,
      profileBootstrapError,
      signInWithSupabaseSession,
      signInPortalSession,
      updatePortalSession,
      retryProfileBootstrap,
      signOut,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
