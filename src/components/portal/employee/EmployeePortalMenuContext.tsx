import { createContext, useContext } from 'react';
export const EmployeePortalMenuContext = createContext<(() => void) | null>(null);
export function useEmployeePortalMenu() { return useContext(EmployeePortalMenuContext); }
