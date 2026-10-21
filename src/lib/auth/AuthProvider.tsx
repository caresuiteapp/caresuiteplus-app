import { configurePortalBackgroundRefresh } from '@/lib/offline/portalBackgroundRefresh';
import { cancelAssignmentDetailPrefetch } from '@/lib/offline/assignmentDetailPrefetch';
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { runAppTransition } from '@/lib/react/runAppTransition';
import { Platform } from 'react-native';
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
import { revokePortalSession } from './portalSessionSecurityService';
import { clearBusinessWelcomePending } from './businessWelcomeSession';
import { shouldClearAuthOnNullSessionEvent } from './authStateEvents';
import { clearOfflineDb } from '@/lib/offline/idb';
import { withAuthBootstrapTimeout } from './authBootstrapTimeout';
import { unregisterPortalPushDeviceBeforeLogout } from '@/lib/portal/portalPushNotifications';
import { ensurePortalWriteSession, isPortalSupabaseIdentityAligned } from './portalSupabaseAuth';

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
    ...(supabaseSession.user.app_metadata?.portal_type === 'academy_family'
      ? { portalType: 'academy_family', accessScope: 'academy' } : {}),
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

const TRUSTED_SESSION_ROLE_KEYS: readonly RoleKey[] = [
  'business_admin',
  'business_manager',
  'billing',
  'dispatch',
  'nurse',
  'caregiver',
  'counselor',
  'akademie_admin',
  'employee_portal',
  'client_portal',
  'family_portal',
];

/**
 * Keeps a valid signed-in user operational when the profile endpoint is slow.
 * Only signed app_metadata claims are trusted; editable user_metadata is never
 * used to grant a role or tenant here.
 */
function applyTrustedSessionFallback(
  supabaseSession: Session,
  setUser: (user: AuthUser | null) => void,
  setProfile: (profile: Profile | null) => void,
  setSession: (session: AuthSession | null) => void,
): boolean {
  const metadata = supabaseSession.user.app_metadata ?? {};
  const roleClaim = typeof metadata.role_key === 'string' ? metadata.role_key : '';
  const tenantClaim = typeof metadata.tenant_id === 'string' ? metadata.tenant_id.trim() : '';
  if (!TRUSTED_SESSION_ROLE_KEYS.includes(roleClaim as RoleKey) || !tenantClaim) return false;

  const roleKey = roleClaim as RoleKey;
  const minimal = buildMinimalAuthState(supabaseSession);
  const displayNameClaim = metadata.display_name;
  const displayName = typeof displayNameClaim === 'string' && displayNameClaim.trim()
    ? displayNameClaim.trim()
    : null;
  const now = new Date().toISOString();
  const user = { ...minimal.user, displayName, roleKey };

  setUser(user);
  setProfile({
    id: supabaseSession.user.id,
    tenantId: tenantClaim,
    roleId: null,
    roleKey,
    firstName: null,
    lastName: null,
    displayName,
    email: supabaseSession.user.email ?? null,
    phone: null,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
  });
  setSession({ ...minimal.session, user });
  return true;
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
  portalRecord?: PortalSessionRecord | null,
  canCommit: () => boolean = () => true,
): Promise<HydrateSupabaseSessionResult> {
  if (portalRecord && !isPortalSupabaseIdentityAligned(supabaseSession, portalRecord)) {
    return { ok: false, error: 'Die sichere Sitzung gehört nicht zum aktiven Portal. Bitte erneut anmelden.' };
  }
  if (supabaseSession.user.app_metadata?.portal_type === 'academy_family') {
    const metadata = supabaseSession.user.app_metadata;
    if (metadata.role_key !== 'family_portal' || metadata.access_scope !== 'academy' ||
        typeof metadata.relative_contact_id !== 'string' || !metadata.relative_contact_id ||
        typeof metadata.portal_account_id !== 'string' || !metadata.portal_account_id ||
        !Number.isSafeInteger(metadata.academy_access_generation) || Number(metadata.academy_access_generation) < 1) {
      return { ok: false, error: 'Der persönliche Akademiezugang ist nicht vollständig bestätigt. Bitte erneut anmelden.' };
    }
    if (!canCommit()) return { ok: true };
    // Academy-only identities intentionally cannot read general profile/module endpoints.
    if (portalRecord) applyPortalAuthFallback(supabaseSession, portalRecord, setUser, setProfile, setSession);
    else if (!applyTrustedSessionFallback(supabaseSession, setUser, setProfile, setSession)) {
      return { ok: false, error: 'Der persönliche Akademiezugang ist nicht vollständig bestätigt. Bitte erneut anmelden.' };
    }
    setProfileBootstrapError(null);
    return { ok: true };
  }
  try {
    const bootstrap = await withAuthBootstrapTimeout(
      bootstrapTenantContext(supabaseSession),
      'Profil-Bootstrap',
    );
    if (!canCommit()) return { ok: true };
    if (bootstrap.ok) {
      setProfileBootstrapError(null);
      const aligned = portalRecord
        ? alignBootstrapWithPortalSession(bootstrap, portalRecord)
        : bootstrap;
      applyBootstrap(aligned, setUser, setProfile, setSession);
      if (aligned.profile.roleKey && aligned.profile.tenantId) {
        void fetchRuntimePermissions(aligned.profile.roleKey, aligned.profile.tenantId);
        void hydrateTenantModulesFromSupabase(aligned.profile.tenantId);
        void hydrateTenantModuleSettings(aligned.profile.tenantId);
      }
      return { ok: true };
    }

    if (portalRecord) {
      applyPortalAuthFallback(
        supabaseSession,
        portalRecord,
        setUser,
        setProfile,
        setSession,
      );
      setProfileBootstrapError(null);
      return { ok: true };
    }

    if (applyTrustedSessionFallback(supabaseSession, setUser, setProfile, setSession)) {
      setProfileBootstrapError(null);
      const metadata = supabaseSession.user.app_metadata ?? {};
      const roleKey = metadata.role_key as RoleKey;
      const tenantId = metadata.tenant_id as string;
      void fetchRuntimePermissions(roleKey, tenantId);
      void hydrateTenantModulesFromSupabase(tenantId);
      void hydrateTenantModuleSettings(tenantId);
      return { ok: true };
    }

    return { ok: false, error: bootstrap.error };
  } catch (cause) {
    if (!canCommit()) return { ok: true };
    if (portalRecord) {
      applyPortalAuthFallback(supabaseSession, portalRecord, setUser, setProfile, setSession);
      setProfileBootstrapError(null);
      return { ok: true };
    }

    if (applyTrustedSessionFallback(supabaseSession, setUser, setProfile, setSession)) {
      setProfileBootstrapError(null);
      const metadata = supabaseSession.user.app_metadata ?? {};
      const roleKey = metadata.role_key as RoleKey;
      const tenantId = metadata.tenant_id as string;
      void fetchRuntimePermissions(roleKey, tenantId);
      void hydrateTenantModulesFromSupabase(tenantId);
      void hydrateTenantModuleSettings(tenantId);
      return { ok: true };
    }

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
  const portalSessionRef = useRef(portalSession);
  portalSessionRef.current = portalSession;
  const [profileBootstrapError, setProfileBootstrapError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const profileRepairAttemptedRef = useRef(false);
  const signOutRequestedRef = useRef(false);
  const authGenerationRef = useRef(0);
  const canCommitGeneration = useCallback((generation: number) =>
    generation === authGenerationRef.current && !signOutRequestedRef.current, []);

  const applyMinimalAuthOnBootstrapFailure = useCallback(
    (supabaseSession: Session, error: string) => {
      const minimal = buildMinimalAuthState(supabaseSession);
      setUser(minimal.user);
      setProfile(null);
      setSession(minimal.session);
      setProfileBootstrapError(error);
      // Keep the single automatic repair marked as attempted. Resetting
      // it on every failure restarted this effect indefinitely for roleless
      // profiles and repeatedly replaced the state while recovery was open.
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let unsubscribeAuth: (() => void) | undefined;
    const generation = authGenerationRef.current;
    const canRestore = () => !cancelled && canCommitGeneration(generation);

    async function restoreSupabaseSession(restoredPortal: PortalSessionRecord | null) {
      try {
        // A persisted Supabase session can still carry the pre-update JWT or a
        // different auth-user link. Validate the full RLS identity on every
        // portal bootstrap instead of refreshing only when no session exists.
        const repaired = restoredPortal
          ? await ensurePortalWriteSession(restoredPortal)
          : null;
        const sessionResult = repaired?.ok
          ? { ok: true as const, data: repaired.data }
          : await getSession();
        if (!canRestore()) return;

        const verifiedPortal = restoredPortal && sessionResult.ok &&
          isPortalSupabaseIdentityAligned(sessionResult.data, restoredPortal)
          ? restoredPortal : null;
        if (restoredPortal && !verifiedPortal) {
          await clearPortalSession();
          if (!canRestore()) return;
        }
        if (verifiedPortal) {
          portalSessionRef.current = verifiedPortal;
          setPortalSession(verifiedPortal);
        }

        if (sessionResult.ok && sessionResult.data) {
          const hydrated = await hydrateSupabaseSession(
            sessionResult.data,
            setUser,
            setProfile,
            setSession,
            setProfileBootstrapError,
            verifiedPortal,
            canRestore,
          );
          if (canRestore() && !hydrated.ok) {
            applyMinimalAuthOnBootstrapFailure(sessionResult.data, hydrated.error);
          }
        }
      } catch (cause) {
        if (!canRestore()) return;
        const sessionResult = await getSession();
        if (!canRestore() || !sessionResult.ok || !sessionResult.data) return;
        applyMinimalAuthOnBootstrapFailure(
          sessionResult.data,
          cause instanceof Error ? cause.message : 'Sitzung konnte nicht wiederhergestellt werden.',
        );
      }
    }

    async function init() {
      try {
        let restoredPortal: PortalSessionRecord | null = null;
        try {
          restoredPortal = await withAuthBootstrapTimeout(
            loadPortalSession(),
            'Portal-Sitzung',
            4_000,
          );
        } catch {
          restoredPortal = null;
        }
        // Live sessions are published only after their signed identity matches
        // the persisted record. A saved access account cannot relabel a user.
        if (authMode !== 'supabase' && canRestore() && restoredPortal) {
          portalSessionRef.current = restoredPortal;
          setPortalSession(restoredPortal);
        }

        if (authMode === 'supabase') {
          let pendingPortalRestore = restoredPortal;
          const restoration = restoreSupabaseSession(restoredPortal).finally(() => {
            pendingPortalRestore = null;
          });

          const handle = onAuthStateChange((event: AuthChangeEvent, supabaseSession) => {
            if (cancelled) return;
            if (supabaseSession && signOutRequestedRef.current) return;
            if (event === 'TOKEN_REFRESHED') return;
            // Web already restores explicitly. INITIAL_SESSION used to run a
            // second profile/tenant bootstrap while the first was still pending.
            if (Platform.OS === 'web' && event === 'INITIAL_SESSION') return;
            // Account switches and logout invalidate pending identity requests
            // on every platform, including native background restoration.
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
              authGenerationRef.current += 1;
              profileRepairAttemptedRef.current = false;
            }
            const eventGeneration = authGenerationRef.current;
            const canCommitEvent = () => !cancelled && canCommitGeneration(eventGeneration);

            void (async () => {
              try {
                if (supabaseSession) {
                  const currentPortal = portalSessionRef.current;
                  // Session repair can emit SIGNED_IN before restoration returns.
                  // Publish its saved first-login state only if this signed event
                  // verifies that pending account, then retire the candidate.
                  const candidatePortal = currentPortal ?? pendingPortalRestore;
                  const alignedPortal = candidatePortal && isPortalSupabaseIdentityAligned(supabaseSession, candidatePortal)
                    ? candidatePortal : null;
                  pendingPortalRestore = null;
                  if (alignedPortal && !currentPortal) {
                    portalSessionRef.current = alignedPortal;
                    setPortalSession(alignedPortal);
                  }
                  if (currentPortal && !alignedPortal) {
                    portalSessionRef.current = null;
                    setPortalSession(null);
                  }
                  const result = await hydrateSupabaseSession(
                    supabaseSession,
                    setUser,
                    setProfile,
                    setSession,
                    setProfileBootstrapError,
                    alignedPortal,
                    canCommitEvent,
                  );
                  if (!result.ok && canCommitEvent()) {
                    applyMinimalAuthOnBootstrapFailure(supabaseSession, result.error);
                  }
                  return;
                }

                if (!shouldClearAuthOnNullSessionEvent(event, signOutRequestedRef.current)) {
                  return;
                }

                if (!cancelled) {
                  pendingPortalRestore = null;
                  portalSessionRef.current = null;
                  setPortalSession(null);
                  setUser(null);
                  setProfile(null);
                  setSession(null);
                  setProfileBootstrapError(null);
                }
              } catch (cause) {
                if (!canCommitEvent() || !supabaseSession) return;
                applyMinimalAuthOnBootstrapFailure(
                  supabaseSession,
                  cause instanceof Error ? cause.message : 'Sitzung konnte nicht aktualisiert werden.',
                );
              }
            })();
          });
          unsubscribeAuth = handle.unsubscribe;
          // Keep route guards pending until the initial identity is known.
          // Otherwise they briefly render login/legacy pages and redirect again.
          if (Platform.OS === 'web') await restoration;
        }
      } finally {
        if (!cancelled) {
          runAppTransition(() => {
            setIsLoading(false);
            setIsInitialized(true);
          });
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
      unsubscribeAuth?.();
    };
  }, [applyMinimalAuthOnBootstrapFailure, authMode, canCommitGeneration]);

  useEffect(() => {
    if (!user || !session) {
      profileRepairAttemptedRef.current = false;
    }
  }, [user, session]);

  useEffect(() => {
    // Web awaits its initial restore and stays subscribed to auth changes.
    if (Platform.OS === 'web') return;
    if (authMode !== 'supabase' || !isInitialized || isLoading) return;
    if (signOutRequestedRef.current) return;
    if (Boolean((user && session) || portalSession)) return;

    let cancelled = false;
    const generation = authGenerationRef.current;
    const canCommit = () => !cancelled && canCommitGeneration(generation);

    async function reconcileLiveSession() {
      const sessionResult = await getSession();
      if (!canCommit() || !sessionResult.ok || !sessionResult.data) return;

      const hydrated = await hydrateSupabaseSession(
        sessionResult.data,
        setUser,
        setProfile,
        setSession,
        setProfileBootstrapError,
        portalSession,
        canCommit,
      );
      if (!canCommit()) return;
      if (hydrated.ok) return;

      applyMinimalAuthOnBootstrapFailure(sessionResult.data, hydrated.error);
    }

    void reconcileLiveSession();

    return () => {
      cancelled = true;
    };
  }, [applyMinimalAuthOnBootstrapFailure, authMode, canCommitGeneration, isInitialized, isLoading, portalSession, session, user]);

  useEffect(() => {
    if (authMode !== 'supabase' || !isInitialized || isLoading) return;
    if (signOutRequestedRef.current) return;
    if (!user || !session || profile?.roleKey || profileRepairAttemptedRef.current) return;

    profileRepairAttemptedRef.current = true;
    let cancelled = false;
    const generation = authGenerationRef.current;
    const canCommit = () => !cancelled && canCommitGeneration(generation);

    async function repairProfileFromSession() {
      const sessionResult = await getSession();
      if (!canCommit() || !sessionResult.ok || !sessionResult.data) return;

      const result = await hydrateSupabaseSession(
        sessionResult.data,
        setUser,
        setProfile,
        setSession,
        setProfileBootstrapError,
        portalSession,
        canCommit,
      );
      if (!canCommit()) return;
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
    canCommitGeneration,
    isInitialized,
    isLoading,
    user,
    session,
    profile?.roleKey,
    portalSession,
  ]);

  const signInWithSupabaseSession = useCallback(async (supabaseSession: Session) => {
    if (signOutRequestedRef.current) return;
    const generation = ++authGenerationRef.current;
    profileRepairAttemptedRef.current = false;
    const canCommit = () => canCommitGeneration(generation);
    portalSessionRef.current = null;
    try {
      await withAuthBootstrapTimeout(clearPortalSession(), 'Portal-Sitzung löschen', 4_000);
    } catch {
      if (canCommit()) setPortalSession(null);
    }
    if (!canCommit()) return;
    setPortalSession(null);
    setProfileBootstrapError(null);

    const hydrated = await hydrateSupabaseSession(
      supabaseSession,
      setUser,
      setProfile,
      setSession,
      setProfileBootstrapError,
      null,
      canCommit,
    );
    if (!hydrated.ok && canCommit()) {
      applyMinimalAuthOnBootstrapFailure(supabaseSession, hydrated.error);
    }
  }, [applyMinimalAuthOnBootstrapFailure, canCommitGeneration]);

  const retryProfileBootstrap = useCallback(async () => {
    const generation = authGenerationRef.current;
    const canCommit = () => canCommitGeneration(generation);
    if (!canCommit()) return;
    setProfileBootstrapError(null);
    profileRepairAttemptedRef.current = true;

    const sessionResult = await getSession();
    if (!canCommit()) return;
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
      portalSession,
      canCommit,
    );
    if (!result.ok && canCommit()) {
      applyMinimalAuthOnBootstrapFailure(sessionResult.data, result.error);
    }
  }, [applyMinimalAuthOnBootstrapFailure, canCommitGeneration, portalSession]);

  const signInPortalSession = useCallback(async (record: PortalSessionRecord) => {
    if (signOutRequestedRef.current) return;
    const generation = ++authGenerationRef.current;
    profileRepairAttemptedRef.current = false;
    const canCommit = () => canCommitGeneration(generation);
    const sessionResult = await getSession();
    if (!canCommit()) return;
    if (authMode === 'supabase' && (!sessionResult.ok ||
      !isPortalSupabaseIdentityAligned(sessionResult.data, record))) {
      throw new Error('Die sichere Sitzung gehört nicht zum aktiven Portal. Bitte erneut anmelden.');
    }
    await savePortalSession(record);
    if (!canCommit()) return;
    portalSessionRef.current = record;
    setPortalSession(record);

    if (!canCommit() || !sessionResult.ok || !sessionResult.data) return;

    await hydrateSupabaseSession(
      sessionResult.data,
      setUser,
      setProfile,
      setSession,
      setProfileBootstrapError,
      record,
      canCommit,
    );
  }, [authMode, canCommitGeneration]);

  const updatePortalSession = useCallback(async (patch: Partial<PortalSessionRecord>) => {
    const target = portalSessionRef.current;
    setPortalSession((current) => {
      if (!current || !target || current.accountId !== target.accountId ||
          current.tenantId !== target.tenantId || current.sessionToken !== target.sessionToken) return current;
      const next = { ...current, ...patch };
      portalSessionRef.current = next;
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

  const backgroundRefreshEnabled = Boolean(portalSession && !portalSession.mustChangePassword && (portalSession.employeeId || portalSession.clientId));
  useEffect(() => {
    void configurePortalBackgroundRefresh(backgroundRefreshEnabled);
  }, [backgroundRefreshEnabled]);

  const signOut = useCallback(async () => {
    authGenerationRef.current += 1;
    signOutRequestedRef.current = true;
    if (Platform.OS === 'web') setSignOutError(null);
    setIsLoading(true);
    cancelAssignmentDetailPrefetch();
    let signedOut = false;
    try {
      await unregisterPortalPushDeviceBeforeLogout().catch(() => undefined);
      if (portalSession?.sessionToken) {
        await revokePortalSession(portalSession.sessionToken).catch(() => undefined);
      }
      const result = await supabaseSignOut();
      if (Platform.OS === 'web' && !result.ok) throw new Error(result.error);
      signedOut = true;
    } catch (cause) {
      if (Platform.OS === 'web') {
        setSignOutError(cause instanceof Error ? cause.message : 'Abmeldung konnte nicht abgeschlossen werden.');
      }
      throw cause;
    } finally {
      if (Platform.OS !== 'web') {
        try {
          await configurePortalBackgroundRefresh(false);
          await clearPortalSession();
          await clearOfflineDb();
        } finally {
          clearBusinessWelcomePending();
          setUser(null);
          setProfile(null);
          setSession(null);
          portalSessionRef.current = null;
          setPortalSession(null);
          setProfileBootstrapError(null);
          signOutRequestedRef.current = false;
          setIsLoading(false);
        }
      } else {
        try {
          if (signedOut) {
            await configurePortalBackgroundRefresh(false);
            await clearPortalSession();
            await clearOfflineDb();
          }
        } finally {
          if (signedOut) {
            clearBusinessWelcomePending();
            setUser(null);
            setProfile(null);
            setSession(null);
            portalSessionRef.current = null;
            setPortalSession(null);
            setProfileBootstrapError(null);
          }
          signOutRequestedRef.current = false;
          setIsLoading(false);
        }
      }
    }
  }, [portalSession]);

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
      signOutError,
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
      signOutError,
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
