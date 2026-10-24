import { CompanyWorkspaceScreen } from '@/screens/office/CompanyWorkspaceScreen.native';
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';

export default function CompanyInventoryRoute() {
  return <LiquidModuleRouteLayout><CompanyWorkspaceScreen initialTab="inventory" /></LiquidModuleRouteLayout>;
}
