import { Redirect, type Href } from 'expo-router';
import { TENANT_SETTINGS_ROUTE } from '@/lib/tenant/tenantSettingsRoute';

/** Einstellungen-Index — leitet auf den Mandanten-Bereich weiter (Breadcrumb-Ziel). */
export default function SettingsIndexRoute() {
  return <Redirect href={TENANT_SETTINGS_ROUTE as Href} />;
}
