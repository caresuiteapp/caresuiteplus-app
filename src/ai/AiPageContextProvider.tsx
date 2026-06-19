import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { getRegisteredPageContext } from './registerAiPageContext';
import type { AiPageContextSnapshot } from './aiToolTypes';

type AiPageContextValue = {
  snapshot: AiPageContextSnapshot;
};

const AiPageContext = createContext<AiPageContextValue | null>(null);

type AiPageContextProviderProps = {
  children: ReactNode;
};

export function AiPageContextProvider({ children }: AiPageContextProviderProps) {
  const value = useMemo(
    () => ({
      snapshot: getRegisteredPageContext(),
    }),
    [],
  );

  return <AiPageContext.Provider value={value}>{children}</AiPageContext.Provider>;
}

export function useAiPageContextSnapshot(): AiPageContextSnapshot {
  const ctx = useContext(AiPageContext);
  return ctx?.snapshot ?? getRegisteredPageContext();
}
