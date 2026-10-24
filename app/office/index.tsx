import { ModuleWorkspaceScreen } from '@/liquid-command/screens/ModuleWorkspaceScreen';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { canonicalDesktopCatalogRoute } from '@/liquid-command/navigation/appsWidgetsCatalogModel.shared';

export default function OfficeIndexRoute() {
  const params = useLocalSearchParams();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  const href = `/office${query.size ? `?${query}` : ''}`;
  const target = canonicalDesktopCatalogRoute(href);
  if (target !== href) return <Redirect href={target as never} />;
  return <ModuleWorkspaceScreen moduleKey="office" />;
}
