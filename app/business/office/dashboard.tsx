import { Redirect, useLocalSearchParams } from 'expo-router';
import { canonicalDesktopCatalogRoute } from '@/liquid-command/navigation/appsWidgetsCatalogModel.shared';

export default function CompanyDashboardAlias() {
  const params = useLocalSearchParams();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  const target = canonicalDesktopCatalogRoute(`/office${query.size ? `?${query}` : ''}`);
  return <Redirect href={target as never} />;
}
