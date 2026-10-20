import { Redirect, type Href } from 'expo-router';
import { TENANT_SETTINGS_ROUTE } from '@/lib/tenant/tenantSettingsRoute';

/** Admin module entry — maps to tenant settings hub. */
export default function AdminIndexRoute() {
  return <Redirect href={TENANT_SETTINGS_ROUTE as Href} />;
}
