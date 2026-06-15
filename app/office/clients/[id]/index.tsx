import { Redirect, useLocalSearchParams } from 'expo-router';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';

export default function ClientDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <Redirect href={clientRecordRoute(id) as never} />;
}
