import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';

export default function SettingsLayout() {
  return <LiquidModuleRouteLayout requireRole={false} requireProduct={false} />;
}
