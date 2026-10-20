import React, { useSyncExternalStore } from 'react';
export function navigate(target: any) {
 const path = typeof target === 'string' ? target : target.pathname;
 if (path === '/platform/support' && new URLSearchParams(location.search).get('platform') !== '1') { location.href = '?platform=1#' + path + (target.params ? '?' + new URLSearchParams(target.params) : ''); return; }
 const query = typeof target === 'string' || !target.params ? '' : `?${new URLSearchParams(target.params)}`;
 location.hash = path + query;
}
const subscribe = (callback: () => void) => { window.addEventListener('hashchange', callback); return () => window.removeEventListener('hashchange', callback); };
export function useRoute() { return useSyncExternalStore(subscribe, () => location.hash.slice(1) || '/auth/register'); }
export const useRouter = () => ({ push: navigate, replace: navigate, back: () => history.back() });
export const usePathname = () => useRoute().split('?')[0];
export function useLocalSearchParams() { const route = useRoute(); return { ...Object.fromEntries(new URLSearchParams(route.split('?')[1] ?? '')), tenantId: route.startsWith('/platform/tenants/') ? route.split('/').at(-1)!.split('?')[0] : undefined }; }
export const Link = ({ href, children, style }: any) => <a href={`#${href}`} style={style}>{children}</a>;
