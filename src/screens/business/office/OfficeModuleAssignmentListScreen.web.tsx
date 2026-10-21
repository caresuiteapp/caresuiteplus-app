import type { ModuleAssignmentSection } from '@/lib/officeCore/types';
import { OfficeModuleAssignmentsScreen } from './OfficeModulesHubScreen.web';

export function OfficeModuleAssignmentListScreen({ section }: { section: ModuleAssignmentSection }) {
  return <OfficeModuleAssignmentsScreen section={section} />;
}
