import { usePathname, useSegments } from 'expo-router';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';

/** True when the active route belongs to CareSuite+ Office. */
export function useIsOfficeRoute(): boolean {
  const pathname = usePathname();
  const segments = useSegments();

  if (resolveMainModuleFromPath(pathname) === 'office') {
    return true;
  }

  const first = segments[0];
  const second = segments[1];
  return first === 'office' || (first === 'business' && second === 'office');
}
