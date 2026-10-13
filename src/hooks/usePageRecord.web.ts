import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router';
import { useAuth } from '@/lib/auth/context';
import { goBackWebPage } from '@/lib/navigation/webNavigationHistory';
import { webPageHref } from '@/lib/navigation/webPageHref';
import { webNavigationScope } from './useWebBackNavigation.web';

export function usePageRecord<T extends string | null>(name: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const router = useRouter();
  const auth = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const focused = useIsFocused();
  const key = `csRecord_${name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const [local] = useState(initial);
  const raw = params[key];
  const value = focused && typeof raw === 'string' && raw.length <= 128 ? raw as T : focused ? local : null as T;
  const scope = webNavigationScope(auth);
  const current = useRef({ focused, value, pathname, params, scope });
  current.current = { focused, value, pathname, params, scope };
  const select: Dispatch<SetStateAction<T>> = useCallback(action => {
    const page = current.current;
    if (!page.focused || page.scope !== scope) return;
    const next = typeof action === 'function' ? action(page.value) : action;
    if (next === page.value) return;
    if (next === null && goBackWebPage(scope)) return;
    const href = webPageHref(page.pathname, page.params, { [key]: next ?? undefined });
    if (next === null) router.replace(href as never); else router.push(href as never);
  }, [key, router, scope]);
  return [value, select];
}
