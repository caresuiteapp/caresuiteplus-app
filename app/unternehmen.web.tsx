import { CompanyWorkspaceScreen } from '@/liquid-command/screens/CompanyWorkspaceScreen.web';
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';

export default function CompanyRoute() {
  return (
    <LiquidModuleRouteLayout>
      <CompanyWorkspaceScreen />
    </LiquidModuleRouteLayout>
  );
}
