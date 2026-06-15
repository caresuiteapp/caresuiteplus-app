import { Redirect } from 'expo-router';
import { getServiceMode } from '@/lib/services/mode';
import { CLIENT_INTAKE_NEW_ROUTE } from '@/lib/navigation/clientRoutes';
import { ClientCreateScreen } from '@/screens/office/ClientCreateScreen';

export default function ClientCreateRoute() {
  if (getServiceMode() === 'supabase') {
    return <ClientCreateScreen />;
  }
  return <Redirect href={CLIENT_INTAKE_NEW_ROUTE as never} />;
}
