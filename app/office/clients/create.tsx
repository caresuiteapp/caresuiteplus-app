import { Redirect } from 'expo-router';
import { CLIENT_INTAKE_NEW_ROUTE } from '@/lib/navigation/clientRoutes';

export default function ClientCreateRoute() {
  return <Redirect href={CLIENT_INTAKE_NEW_ROUTE as never} />;
}
