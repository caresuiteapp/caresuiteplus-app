import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { PortalSignaturesTab } from '@/components/portal/PortalSignaturesTab';

export default function EmployeePortalSignaturesRoute() {
  return (
    <PortalTabScreen title="Unterschriften" hideHeaderOnPhone>
      <PortalSignaturesTab detailBasePath="/portal/employee/signatures" />
    </PortalTabScreen>
  );
}
