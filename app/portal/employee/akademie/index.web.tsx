import { AcademyWorkspaceScreen } from '@/features/akademie/AcademyWorkspaceScreen.web';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';

export default function AcademyPortalRoute() {
  return <PortalTabScreen title="Meine Akademie" scroll={false} contentOwnsHero>
    <AcademyWorkspaceScreen view="learner" />
  </PortalTabScreen>;
}
