import { CompanyWorkspaceScreen } from '@/screens/office/CompanyWorkspaceScreen.native';
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';

export default function CompanySectionRoute() {
  return <LiquidModuleRouteLayout><CompanyWorkspaceScreen initialTab="resources" initialView="fleet" /></LiquidModuleRouteLayout>;
}
