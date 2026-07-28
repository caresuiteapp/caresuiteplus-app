import { ModuleAssignedClientsScreen } from '@/product-workflows/screens/modules/ModuleAssignedClientsScreen';

export default function BeratungAssignedClientsRoute() {
  return (
    <ModuleAssignedClientsScreen
      moduleKey="beratung"
      currentPath="/beratung/zugeordnete-klienten"
    />
  );
}
