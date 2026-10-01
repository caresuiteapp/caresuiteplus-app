import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { shouldOfferWebStartChoice } from './webStartDestinationPolicy';

type WebStartDestination = {
  showChoice: boolean;
  enterSoftware: () => void;
};

const WebStartDestinationContext = createContext<WebStartDestination | null>(null);

/** In document memory only: a fresh visit to / opens the choice again. */
export function WebStartDestinationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [softwareEntered, setSoftwareEntered] = useState(() =>
    typeof window !== 'undefined' && !shouldOfferWebStartChoice(window.location),
  );
  const enterSoftware = useCallback(() => setSoftwareEntered(true), []);

  useEffect(() => {
    // Login, QR confirmation and portal links retain their existing direct flow.
    // Returning to the home screen must not interrupt an in-progress session.
    if (pathname !== '/') enterSoftware();
  }, [enterSoftware, pathname]);

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
