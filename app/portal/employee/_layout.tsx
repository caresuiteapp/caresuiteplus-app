import { LiquidPortalRouteLayout } from '@/liquid-command/shell/LiquidPortalRouteLayout';
import { EmployeeLogbookLifecycleGate } from '@/components/portal/EmployeeLogbookLifecycleGate';
import { EmployeeAssignmentNoticeGate } from '@/components/portal/EmployeeAssignmentNoticeGate';

export default function EmployeePortalLiquidLayout() {
  return (
    <LiquidPortalRouteLayout
      kind="employee"
      overlay={<><EmployeeLogbookLifecycleGate /><EmployeeAssignmentNoticeGate /></>}
    />
  );
}
