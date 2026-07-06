import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type PortalMessengerFocusContextValue = {
  active: boolean;
  setActive: (active: boolean) => void;
};

const PortalMessengerFocusContext = createContext<PortalMessengerFocusContextValue>({
  active: false,
  setActive: () => {},
});

export function PortalMessengerFocusProvider({ children }: { children: ReactNode }) {
  const [active, setActiveState] = useState(false);
  const setActive = useCallback((next: boolean) => {
    setActiveState(next);
  }, []);
  const value = useMemo(() => ({ active, setActive }), [active, setActive]);
  return (
    <PortalMessengerFocusContext.Provider value={value}>
      {children}
    </PortalMessengerFocusContext.Provider>
  );
}

export function usePortalMessengerFocus() {
  return useContext(PortalMessengerFocusContext);
}
