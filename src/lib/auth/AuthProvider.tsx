import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
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

export function AuthProvider({ children }: AuthProviderProps) {
  const authMode = useMemo(() => resolveAuthMode(), []);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [portalSession, setPortalSession] = useState<PortalSessionRecord | null>(null);
  const profileRepairAttemptedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeAuth: (() => void) | undefined;

    async function restoreSupabaseSession() {
      const sessionResult = await getSession();
      if (cancelled) return;

      if (sessionResult.ok && sessionResult.data) {
        const bootstrap = await bootstrapTenantContext(sessionResult.data);
        if (!cancelled) {
          if (bootstrap.ok) {
            applyBootstrap(bootstrap, setUser, setProfile, setSession);
            if (bootstrap.profile.roleKey && bootstrap.profile.tenantId) {
              void fetchRuntimePermissions(bootstrap.profile.roleKey, bootstrap.profile.tenantId);
              void hydrateTenantModulesFromSupabase(bootstrap.profile.tenantId);
            }
          } else {
            applyBootstrap(bootstrap, setUser, setProfile, setSession);
            await supabaseSignOut();
          }
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

        const handle = onAuthStateChange(async (_event, supabaseSession) => {
          if (cancelled) return;

          if (supabaseSession) {
            const bootstrap = await bootstrapTenantContext(supabaseSession);
            if (bootstrap.ok) {
              applyBootstrap(bootstrap, setUser, setProfile, setSession);
              if (bootstrap.profile.roleKey && bootstrap.profile.tenantId) {
                void fetchRuntimePermissions(bootstrap.profile.roleKey, bootstrap.profile.tenantId);
                void hydrateTenantModulesFromSupabase(bootstrap.profile.tenantId);
              }
            }
            return;
          }

          setUser(null);
          setProfile(null);
          setSession(null);
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
      throw new Error('Demo-Anmeldung nur im Demo-Modus verfÃ¼gbar.');
    }
    setIsLoading(true);
    try {
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
      throw new Error('Supabase-Anmeldung nur im Live-Modus verfÃ¼gbar.');
    }
    setIsLoading(true);
    try {
      const bootstrap = await bootstrapTenantContext(supabaseSession);
      applyBootstrap(bootstrap, setUser, setProfile, setSession);
      if (bootstrap.ok && bootstrap.profile.roleKey && bootstrap.profile.tenantId) {
        void fetchRuntimePermissions(bootstrap.profile.roleKey, bootstrap.profile.tenantId);
        void hydrateTenantModulesFromSupabase(bootstrap.profile.tenantId);
      }
      if (!bootstrap.ok) {
        await supabaseSignOut();
        throw new Error(bootstrap.error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [authMode]);

  const signInPortalSession = useCallback(async (record: PortalSessionRecord) => {
    await savePortalSession(record);
    setPortalSession(record);
  }, []);

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
      setIsLoading(false);
    }
  }, [authMode]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isInitialized,
      isLoading,
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
