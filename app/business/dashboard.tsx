import { BUSINESS_HOME_ROUTE } from '@/lib/navigation/businessHome';
import { Redirect, type Href } from 'expo-router';

export default function BusinessDashboardAliasRoute() {
  return <Redirect href={BUSINESS_HOME_ROUTE as Href} />;
}
