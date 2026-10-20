import { ModuleAssignedClientsScreen } from '@/product-workflows/screens/modules/ModuleAssignedClientsScreen';

export default function PflegeAssignedClientsRoute() {
  return (
    <ModuleAssignedClientsScreen
      moduleKey="pflege"
      currentPath="/pflege/zugeordnete-klienten"
    />
  );
}
