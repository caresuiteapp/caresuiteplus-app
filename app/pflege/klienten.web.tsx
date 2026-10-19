import { useRouter } from 'expo-router';
import { ClientsListScreen } from '@/product-workflows/screens/office/ClientsListScreen';
export default function PflegeClientsRoute() {
  const router = useRouter();
  return <ClientsListScreen moduleLabel="Pflege" contextLabel="Klient:innen mit vollständiger Pflegeakte" useModals={false} onClientPress={id => router.push({ pathname: '/pflege/klienten/[id]', params: { id } } as never)} />;
}
