import { InventoryDashboardScreen } from '@/product-workflows/screens/inventory/InventoryDashboardScreen';

export default function PflegeInventoryRoute() {
  return (
    <InventoryDashboardScreen
      baseRoute="/pflege/inventar"
      contextLabel="Pflege · Ausstattung und Betriebsmittel"
    />
  );
}
