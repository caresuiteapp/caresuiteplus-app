import { createContext, useContext } from 'react';

// Deliberately in memory: a new app process always plays the intro again.
export const appStartIntroSession = { completed: false };
export const AppStartIntroReadyContext = createContext(true);
export const useAppStartIntroReady = () => useContext(AppStartIntroReadyContext);
