import { ConsultationWorkspaceScreen } from '@/features/beratung/ConsultationWorkspaceScreen.web';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

export default function EmployeeConsultationRoute() {
  return <PortalTabScreen title="Beratung & Schulungen" scroll={false} contentOwnsHero>
    <ConsultationWorkspaceScreen employeeView />
  </PortalTabScreen>;
}
