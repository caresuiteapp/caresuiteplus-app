import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PlatformUser } from '@/types/platformConsole';
import { fetchPlatformCurrentUser } from '@/lib/platformConsole/platformAuthService';

type PlatformAuthContextValue = {
  platformUser: PlatformUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isActivePlatformUser: boolean;
};

const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null);

type PlatformAuthProviderProps = {
  children: ReactNode;
};

export function PlatformAuthProvider({ children }: PlatformAuthProviderProps) {
  const [platformUser, setPlatformUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformCurrentUser();
    if (!result.ok) {
      setPlatformUser(null);
      setError(result.error);
      setLoading(false);
      return;
    }
    setPlatformUser(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      platformUser,
      loading,
      error,
      refresh,
      isActivePlatformUser: platformUser?.status === 'active',
    }),
    [platformUser, loading, error, refresh],
  );

  return (
    <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth(): PlatformAuthContextValue {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) {
    throw new Error('usePlatformAuth must be used within PlatformAuthProvider');
  }
  return ctx;
}
