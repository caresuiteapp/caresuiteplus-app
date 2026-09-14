import { BUSINESS_HOME_ROUTE } from '@/lib/navigation/businessHome';
import { Redirect, type Href } from 'expo-router';

/** Zentrale alias — maps to business hub without breaking existing /business routes. */
export default function ZentraleIndexRoute() {
  return <Redirect href={BUSINESS_HOME_ROUTE as Href} />;
}
