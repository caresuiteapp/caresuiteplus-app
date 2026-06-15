import { ModuleAssignedClientsScreen } from '@/screens/modules/ModuleAssignedClientsScreen';

export default function PflegeAssignedClientsRoute() {
  return (
    <ModuleAssignedClientsScreen
      moduleKey="pflege"
      currentPath="/pflege/zugeordnete-klienten"
    />
  );
}
