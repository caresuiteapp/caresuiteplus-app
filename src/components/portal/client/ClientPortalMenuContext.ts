import { createContext, useContext } from 'react';
export const ClientPortalMenuContext = createContext<(() => void) | null>(null);
export const useClientPortalMenu = () => useContext(ClientPortalMenuContext);
