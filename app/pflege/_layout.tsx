import { CareRuntimePermissionsProvider } from '@/hooks/pflege/useCareRuntimePermissions';
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';

export default function PflegeLayout() {
  return <LiquidModuleRouteLayout nativeRoleOwnerPath="/pflege" workspaceProvider={CareRuntimePermissionsProvider} />;
}
