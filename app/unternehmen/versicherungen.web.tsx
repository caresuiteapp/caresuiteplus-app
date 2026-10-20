import { CompanyWorkspaceScreen } from '@/liquid-command/screens/CompanyWorkspaceScreen.web';
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';

export default function CompanySectionRoute() {
  return <LiquidModuleRouteLayout><CompanyWorkspaceScreen initialTab="resources" initialView="insurance" /></LiquidModuleRouteLayout>;
}
