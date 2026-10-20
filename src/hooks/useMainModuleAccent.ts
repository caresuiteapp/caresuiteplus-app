import { usePathname } from 'expo-router';
import { resolveMainModuleAccent } from '@/lib/navigation/mainModuleAccent';
import { resolveMainModuleFromPath } from '@/lib/navigation/resolvemainmodule';

/** Active module accent derived from the current route — single source for shell chrome. */
export function useMainModuleAccent(): string {
  const pathname = usePathname();
  return resolveMainModuleAccent(resolveMainModuleFromPath(pathname));
}
