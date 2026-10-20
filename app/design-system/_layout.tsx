import { DevToolGate } from '@/product-workflows/components/auth/DevToolGate';
import { LiquidModuleRouteLayout } from '@/liquid-command/shell/LiquidModuleRouteLayout';

export default function DesignSystemLayout() {
  return (
    <DevToolGate>
      <LiquidModuleRouteLayout requireProduct={false} />
    </DevToolGate>
  );
}
