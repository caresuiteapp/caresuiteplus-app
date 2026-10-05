import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { shouldOfferWebStartChoice } from './webStartDestinationPolicy';

type WebStartDestination = {
  showChoice: boolean;
  enterSoftware: () => void;
};

const WebStartDestinationContext = createContext<WebStartDestination | null>(null);

/** In document memory only: a fresh visit to / opens the choice again. */
export function WebStartDestinationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [softwareEntered, setSoftwareEntered] = useState(() =>
    typeof window !== 'undefined' && !shouldOfferWebStartChoice(window.location),
  );
  const enterSoftware = useCallback(() => {
    // Keep the choice mounted until navigation commits. Revealing the home
    // entry first would let a saved session redirect before /auth opens.
    router.replace('/auth' as never);
  }, [router]);

  useEffect(() => {
    // Login, QR confirmation and portal links retain their existing direct flow.
    // Returning to the home screen must not interrupt an in-progress session.
    if (pathname !== '/') setSoftwareEntered(true);
  }, [pathname]);

  const showChoice = pathname === '/' && !softwareEntered;
  const value = useMemo(() => ({ showChoice, enterSoftware }), [enterSoftware, showChoice]);
  return <WebStartDestinationContext.Provider value={value}>{children}</WebStartDestinationContext.Provider>;
}

export function useWebStartDestination() {
  const value = useContext(WebStartDestinationContext);
  if (!value) throw new Error('WebStartDestinationProvider fehlt.');
  return value;
}

/** Overlays can also render outside the web root (for example in isolated screens). */
export function useWebStartChoiceVisible() {
  return useContext(WebStartDestinationContext)?.showChoice ?? false;
}
