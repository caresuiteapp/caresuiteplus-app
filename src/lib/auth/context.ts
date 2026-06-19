import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AuthMode } from '@/lib/supabase/config';
import type { AuthSession, AuthUser, Profile, RoleKey } from '@/types';
import type { PortalSessionRecord } from './portalSessionStore';

export type { AuthMode };

export type AuthContextValue = {
  isInitialized: boolean;
  isLoading: boolean;
  /** True once initial session restore and in-flight sign-in have settled. */
  authReady: boolean;
  isAuthenticated: boolean;
  authMode: AuthMode;
  user: AuthUser | null;
  profile: Profile | null;
  session: AuthSession | null;
  portalSession: PortalSessionRecord | null;
  signInDemo: (roleKey: RoleKey) => Promise<void>;
  signInWithSupabaseSession: (session: Session) => Promise<void>;
  signInPortalSession: (session: PortalSessionRecord) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (profile: Profile) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden.');
  }
  return ctx;
}
