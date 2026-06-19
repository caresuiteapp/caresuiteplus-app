import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { AuthSession, AuthUser, Profile, RoleKey } from '@/types';
import {
  getSession,
  isDemoMode,
  onAuthStateChange,
  resolveAuthMode,
  signOut as supabaseSignOut,
} from '@/lib/supabase';
import { bootstrapTenantContext } from '@/lib/supabase/tenantService';
import { hydrateTenantModulesFromSupabase } from '@/lib/modules/moduleAccessHydration';
import { fetchRuntimePermissions } from '@/lib/supabase/permissionRepository';
import { AuthContext, type AuthContextValue } from './context';
import { buildDemoSession } from './demoSession';
import {
  clearPortalSession,
  loadPortalSession,
  savePortalSession,
  type PortalSessionRecord,
} from './portalSessionStore';
import { shouldClearAuthOnNullSessionEvent } from './authStateEvents';

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

async function hydrateSupabaseSession(
  supabaseSession: Session,
  setUser: (user: AuthUser | null) => void,
  setProfile: (profile: Profile | null) => void,
  setSession: (session: AuthSession | null) => void,
): Promise<boolean> {
  const bootstrap = await bootstrapTenantContext(supabaseSession);
  if (bootstrap.ok) {
    applyBootstrap(bootstrap, setUser, setProfile, setSession);
    if (bootstrap.profile.roleKey && bootstrap.profile.tenantId) {
      void fetchRuntimePermissions(bootstrap.profile.roleKey, bootstrap.profile.tenantId);
      void hydrateTenantModulesFromSupabase(bootstrap.profile.tenantId);
    }
    return true;
  }

  return false;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const authMode = useMemo(() => resolveAuthMode(), []);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [portalSession, setPortalSession] = useState<PortalSessionRecord | null>(null);
  const profileRepairAttemptedRef = useRef(false);
  const signOutRequestedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeAuth: (() => void) | undefined;

    async function restoreSupabaseSession() {
      const sessionResult = await getSession();
      if (cancelled) return;

      if (sessionResult.ok && sessionResult.data) {
        const hydrated = await hydrateSupabaseSession(
          sessionResult.data,
          setUser,
          setProfile,
          setSession,
        );
        if (!cancelled && !hydrated) {
          const minimal = buildMinimalAuthState(sessionResult.data);
          setUser(minimal.user);
          setProfile(null);
          setSession(minimal.session);
          profileRepairAttemptedRef.current = false;
        }
      }
    }

    async function init() {
      const restoredPortal = await loadPortalSession();
      if (!cancelled && restoredPortal) {
        setPortalSession(restoredPortal);
      }

      if (authMode === 'supabase') {
        await restoreSupabaseSession();

        const handle = onAuthStateChange((event: AuthChangeEvent, supabaseSession) => {
          if (cancelled) return;

          void (async () => {
            if (supabaseSession) {
              await hydrateSupabaseSession(supabaseSession, setUser, setProfile, setSession);
              return;
            }

            if (!shouldClearAuthOnNullSessionEvent(event, signOutRequestedRef.current)) {
              return;
            }

            if (!cancelled) {
              setUser(null);
              setProfile(null);
              setSession(null);
            }
          })();
        });
        unsubscribeAuth = handle.unsubscribe;
      }

      if (!cancelled) {
        setIsLoading(false);
        setIsInitialized(true);
      }
    }

    void init();

    return () => {
      cancelled = true;
      unsubscribeAuth?.();
    };
  }, [authMode]);

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
      );
      if (cancelled) return;
      if (hydrated) return;

      const minimal = buildMinimalAuthState(sessionResult.data);
      setUser(minimal.user);
      setProfile(null);
      setSession(minimal.session);
      profileRepairAttemptedRef.current = false;
    }

    void reconcileLiveSession();

    return () => {
      cancelled = true;
    };
  }, [authMode, isInitialized, isLoading, portalSession, session, user]);

  useEffect(() => {
    if (authMode !== 'supabase' || !isInitialized || isLoading) return;
    if (!user || !session || profile?.roleKey || profileRepairAttemptedRef.current) return;

    profileRepairAttemptedRef.current = true;
    let cancelled = false;

    async function repairProfileFromSession() {
      const sessionResult = await getSession();
      if (cancelled || !sessionResult.ok || !sessionResult.data) return;

      const bootstrap = await bootstrapTenantContext(sessionResult.data);
      if (cancelled || !bootstrap.ok) return;

      applyBootstrap(bootstrap, setUser, setProfile, setSession);
      if (bootstrap.profile.roleKey && bootstrap.profile.tenantId) {
        void fetchRuntimePermissions(bootstrap.profile.roleKey, bootstrap.profile.tenantId);
        void hydrateTenantModulesFromSupabase(bootstrap.profile.tenantId);
      }
    }

    void repairProfileFromSession();

    return () => {
      cancelled = true;
    };
  }, [authMode, isInitialized, isLoading, user, session, profile?.roleKey]);

  const signInDemo = useCallback(async (roleKey: RoleKey) => {
    if (!isDemoMode()) {
      throw new Error('Demo-Anmeldung nur im Demo-Modus verfügbar.');
    }
    setIsLoading(true);
    try {
      await clearPortalSession();
      setPortalSession(null);
      const built = buildDemoSession(roleKey);
      setUser(built.user);
      setProfile(built.profile);
      setSession(built.session);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signInWithSupabaseSession = useCallback(async (supabaseSession: Session) => {
    if (authMode !== 'supabase') {
      throw new Error('Supabase-Anmeldung nur im Live-Modus verfügbar.');
    }
    setIsLoading(true);
    try {
      await clearPortalSession();
      setPortalSession(null);

      const hydrated = await hydrateSupabaseSession(
        supabaseSession,
        setUser,
        setProfile,
        setSession,
      );
      if (!hydrated) {
        const minimal = buildMinimalAuthState(supabaseSession);
        setUser(minimal.user);
        setProfile(null);
        setSession(minimal.session);
        profileRepairAttemptedRef.current = false;
      }
    } finally {
      setIsLoading(false);
    }
  }, [authMode]);

  const signInPortalSession = useCallback(async (record: PortalSessionRecord) => {
    await savePortalSession(record);
    setPortalSession(record);

    if (authMode !== 'supabase') return;

    const sessionResult = await getSession();
    if (!sessionResult.ok || !sessionResult.data) return;

    const bootstrap = await bootstrapTenantContext(sessionResult.data);
    if (!bootstrap.ok) return;

    applyBootstrap(bootstrap, setUser, setProfile, setSession);
    if (bootstrap.profile.roleKey && bootstrap.profile.tenantId) {
      void fetchRuntimePermissions(bootstrap.profile.roleKey, bootstrap.profile.tenantId);
      void hydrateTenantModulesFromSupabase(bootstrap.profile.tenantId);
    }
  }, [authMode]);

  const updateProfile = useCallback((nextProfile: Profile) => {
    setProfile(nextProfile);
    setUser((prev) =>
      prev
        ? {
            ...prev,
            displayName: nextProfile.displayName,
          }
        : prev,
    );
  }, []);

  const signOut = useCallback(async () => {
    signOutRequestedRef.current = true;
    setIsLoading(true);
    try {
      if (authMode === 'supabase') {
        await supabaseSignOut();
      }
      await clearPortalSession();
      setUser(null);
      setProfile(null);
      setSession(null);
      setPortalSession(null);
    } finally {
      signOutRequestedRef.current = false;
      setIsLoading(false);
    }
  }, [authMode]);

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
      signInDemo,
      signInWithSupabaseSession,
      signInPortalSession,
      signOut,
      updateProfile,
    }),
    [isInitialized, isLoading, authMode, user, profile, session, portalSession, signInDemo, signInWithSupabaseSession, signInPortalSession, signOut, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
