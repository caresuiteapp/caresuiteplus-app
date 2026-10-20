import { Redirect, useLocalSearchParams } from 'expo-router';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';

export default function ClientDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return <Redirect href="/office/clients" />;
  return <Redirect href={clientRecordRoute(id) as never} />;
}
