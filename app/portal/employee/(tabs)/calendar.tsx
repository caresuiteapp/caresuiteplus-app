import { EmployeePortalCalendarScreen } from '@/product-workflows/components/portal/EmployeePortalCalendarScreen';
import { PortalTabScreen } from '@/product-workflows/screens/portal/PortalTabScreen';

export default function EmployeeCalendarRoute() {
  return (
    <PortalTabScreen title="Teamkalender" contentOwnsHero scroll={false}>
      <EmployeePortalCalendarScreen />
    </PortalTabScreen>
  );
}
