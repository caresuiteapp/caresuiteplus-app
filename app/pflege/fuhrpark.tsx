import { InventoryListScreen } from '@/product-workflows/screens/inventory/InventoryListScreen';

export default function PflegeFleetRoute() {
  return (
    <InventoryListScreen
      variant="items"
      categoryGroupFilter="vehicles"
      titleOverride="Fuhrpark"
      subtitleOverride="Pflegefahrzeuge, Kennzeichnungen, Zustand und Verfügbarkeit"
      backRoute="/pflege/inventar"
    />
  );
}
