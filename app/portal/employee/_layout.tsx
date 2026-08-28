import { LiquidPortalRouteLayout } from '@/liquid-command/shell/LiquidPortalRouteLayout';
import { EmployeeLogbookLifecycleGate } from '@/components/portal/EmployeeLogbookLifecycleGate';

export default function EmployeePortalLiquidLayout() {
  return (
    <LiquidPortalRouteLayout
      kind="employee"
      overlay={<EmployeeLogbookLifecycleGate />}
    />
  );
}
