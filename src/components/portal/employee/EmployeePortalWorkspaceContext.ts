import { createContext, useContext } from 'react';
import type { LiquidPortalNavigationItem } from '@/liquid-command/navigation/portalCatalog';
import type { EmployeePortalWorkspace } from '@/lib/portal/employee/employeePortalWorkspaces';

export type EmployeePortalWorkspaceState = {
  selected: EmployeePortalWorkspace | null;
  available: readonly EmployeePortalWorkspace[];
  navigation: readonly LiquidPortalNavigationItem[];
  loading: boolean;
  error: string | null;
  preferenceError: boolean;
  retry: () => void;
  select: (key: EmployeePortalWorkspace) => void;
};

export const EmployeePortalWorkspaceContext = createContext<EmployeePortalWorkspaceState | null>(null);

export function useEmployeePortalWorkspaceContext() {
  return useContext(EmployeePortalWorkspaceContext);
}
