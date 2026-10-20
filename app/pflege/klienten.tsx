import { ClientsListScreen } from '@/product-workflows/screens/office/ClientsListScreen';

export default function PflegeClientsRoute() {
  return (
    <ClientsListScreen
      moduleLabel="Pflege"
      contextLabel="Klient:innen mit vollständiger Pflegeakte"
    />
  );
}
