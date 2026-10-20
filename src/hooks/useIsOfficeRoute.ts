import { usePathname, useSegments } from 'expo-router';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';

/** True when the active route belongs to CareSuite+ Office. */
export function useIsOfficeRoute(): boolean {
  const pathname = usePathname();
  const segments = useSegments();

  if (resolveMainModuleFromPath(pathname) === 'office') {
    return true;
  }

  const routeSegments = segments as readonly string[];
  const first = routeSegments[0];
  const second = routeSegments[1];
  return first === 'office' || (first === 'business' && second === 'office');
}
