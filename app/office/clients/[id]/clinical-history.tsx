import { Redirect, useLocalSearchParams } from 'expo-router';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';

export default function ClientClinicalHistoryFallback() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={id ? clientRecordRoute(id) as never : '/office/clients'} />;
}
